import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt_lib from 'jsonwebtoken'
import dotenv from 'dotenv'
import { eq, and } from 'drizzle-orm'

import { db, users, conversations, messages, tickets, platforms, userSettings, apiKeys } from './db/index.js'
import { AIService, SYSTEM_PROMPT } from './services/ai/index.js'
import { GitLabClient } from './services/platforms/gitlab.js'
import { GitHubClient } from './services/platforms/github.js'
import type { AIProviderType } from './services/ai/types.js'
import type { PlatformType } from './services/platforms/types.js'

dotenv.config()

const app = new Hono()

// Initialize AI Service
const aiService = new AIService({
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
})

// Middleware
app.use('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Auth middleware
const authMiddleware = jwt({
  secret: process.env.JWT_SECRET || 'fallback-secret',
})

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const chatSchema = z.object({
  message: z.string(),
  conversationId: z.string().optional(),
  aiModel: z.enum(['openai', 'anthropic', 'google']).optional(),
})

const createTicketsSchema = z.object({
  conversationId: z.string(),
  tickets: z.array(z.object({
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()),
    tasks: z.array(z.string()),
    labels: z.array(z.string()),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  platformId: z.string(),
  projectId: z.string(),
  milestoneId: z.string().optional(),
})

const platformSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['gitlab', 'github']),
  baseUrl: z.string().url().optional(),
  token: z.string().min(1),
}).refine((data) => {
  // For GitLab, baseUrl is required
  if (data.type === 'gitlab' && !data.baseUrl) {
    return false;
  }
  return true;
}, {
  message: "GitLab platforms require a baseUrl",
  path: ["baseUrl"],
})

// Auth routes
app.post('/api/auth/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, username, password } = c.req.valid('json')
    
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username))
    })
    
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 400)
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)
    
    // Create user
    const [user] = await db.insert(users).values({
      email,
      username,
      passwordHash,
    }).returning()
    
    // Create default settings
    await db.insert(userSettings).values({
      userId: user.id,
    })
    
    // Generate JWT
    const token = jwt_lib.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    )
    
    return c.json({
      user: { id: user.id, email: user.email, username: user.username },
      token,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

app.post('/api/auth/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json')
    
    // Find user
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email)
    })
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    // Generate JWT
    const token = jwt_lib.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    )
    
    return c.json({
      user: { id: user.id, email: user.email, username: user.username },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Protected routes
app.use('/api/protected/*', authMiddleware)

// Chat routes
app.post('/api/protected/chat', zValidator('json', chatSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const { message, conversationId, aiModel } = c.req.valid('json')
    
    let conversation
    let chatHistory: any[] = []
    
    if (conversationId) {
      // Get existing conversation
      conversation = await db.query.conversations.findFirst({
        where: (conversations, { eq, and }) => and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, payload.userId)
        ),
        with: {
          messages: {
            orderBy: (messages, { asc }) => [asc(messages.createdAt)]
          }
        }
      })
      
      if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404)
      }
      
      chatHistory = conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    } else {
      // Create new conversation
      const [newConversation] = await db.insert(conversations).values({
        userId: payload.userId,
        title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        aiModel: aiModel || 'openai',
      }).returning()
      
      conversation = newConversation
    }
    
    // Add user message to history and database
    chatHistory.push({ role: 'user', content: message })
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'user',
      content: message,
    })
    
    // Get AI response
    const preferredModel = aiModel || conversation.aiModel as AIProviderType
    const aiResponse = await aiService.generateResponseWithFallback(
      preferredModel,
      chatHistory,
      SYSTEM_PROMPT
    )
    
    // If tickets were generated, format a comprehensive response
    let formattedResponse = aiResponse.content
    if (aiResponse.tickets && aiResponse.tickets.length > 0) {
      formattedResponse += `

---

## Generated User Stories

I've created ${aiResponse.tickets.length} user story tickets based on your requirements:

${aiResponse.tickets.map((ticket, index) => `
### ${index + 1}. ${ticket.title}

**User Story:** ${ticket.description}

**Priority:** ${ticket.priority}

**Acceptance Criteria:**
${ticket.acceptanceCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

**Tasks:**
${ticket.tasks.map(task => `- [ ] ${task}`).join('\n')}

**Labels:** ${ticket.labels.join(', ')}

---`).join('\n')}

✨ **Ready to create tickets?** Use the "Create Tickets" button to create these on your GitLab or GitHub project!`
    }
    
    // Save AI response
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'assistant',
      content: formattedResponse,
      metadata: JSON.stringify({
        tickets: aiResponse.tickets,
        shouldSplit: aiResponse.shouldSplit,
        clarificationNeeded: aiResponse.clarificationNeeded,
      }),
    })

    return c.json({
      conversationId: conversation.id,
      response: formattedResponse,
      tickets: aiResponse.tickets,
      shouldSplit: aiResponse.shouldSplit,
      clarificationNeeded: aiResponse.clarificationNeeded,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return c.json({ error: 'Failed to process message' }, 500)
  }
})

// Add individual message to conversation
const messageSchema = z.object({
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  metadata: z.string().optional(),
})

app.post('/api/protected/messages', zValidator('json', messageSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const { conversationId, role, content, metadata } = c.req.valid('json')
    
    // Verify conversation ownership
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq, and }) => and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, payload.userId)
      )
    })
    
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    // Add message to conversation
    const [message] = await db.insert(messages).values({
      conversationId,
      role,
      content,
      metadata,
    }).returning()
    
    return c.json({ message })
  } catch (error) {
    console.error('Message creation error:', error)
    return c.json({ error: 'Failed to save message' }, 500)
  }
})

// Conversations routes
app.get('/api/protected/conversations', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    
    const userConversations = await db.query.conversations.findMany({
      where: (conversations, { eq }) => eq(conversations.userId, payload.userId),
      orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
      with: {
        messages: {
          limit: 1,
          orderBy: (messages, { desc }) => [desc(messages.createdAt)]
        }
      }
    })
    
    return c.json(userConversations)
  } catch (error) {
    console.error('Conversations fetch error:', error)
    return c.json({ error: 'Failed to fetch conversations' }, 500)
  }
})

// Get single conversation with all messages
app.get('/api/protected/conversations/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const conversationId = c.req.param('id')
    
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq, and }) => and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, payload.userId)
      ),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)]
        }
      }
    })
    
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    return c.json(conversation)
  } catch (error) {
    console.error('Conversation fetch error:', error)
    return c.json({ error: 'Failed to fetch conversation' }, 500)
  }
})

// Delete all conversations for user
app.delete('/api/protected/conversations', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    
    // Delete all conversations for the user (messages and tickets will cascade delete)
    await db.delete(conversations)
      .where(eq(conversations.userId, payload.userId))
    
    return c.json({ success: true, message: 'All conversations deleted successfully' })
  } catch (error) {
    console.error('Conversations deletion error:', error)
    return c.json({ error: 'Failed to delete conversations' }, 500)
  }
})

// Tickets routes
app.post('/api/protected/tickets', zValidator('json', createTicketsSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const { conversationId, tickets: ticketData, platformId, projectId, milestoneId } = c.req.valid('json')
    
    // Verify conversation ownership
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq, and }) => and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, payload.userId)
      )
    })
    
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    let createdTickets = []
    let platformTickets = []

    if (platformId && projectId) {
      // Get platform details
      const platform = await db.query.platforms.findFirst({
        where: (platforms, { eq, and }) => and(
          eq(platforms.id, platformId),
          eq(platforms.userId, payload.userId)
        )
      })

      if (!platform) {
        return c.json({ error: 'Platform not found' }, 404)
      }

      // Create platform client
      const isGitLab = platform.name.startsWith('GITLAB:')
      let client: any
      if (isGitLab) {
        client = new GitLabClient(platform.apiUrl, platform.accessToken)
      } else {
        client = new GitHubClient(platform.accessToken)
      }

      // Create tickets on platform
      for (const ticket of ticketData) {
        try {
          // Format the description with full story details
          const formattedDescription = `${ticket.description}

## Acceptance Criteria
${ticket.acceptanceCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n')}

## Tasks
${ticket.tasks.map((task, index) => `- [ ] ${task}`).join('\n')}

---
*Generated by AI Ticket Generator*`;

          const platformTicket = {
            title: ticket.title,
            description: formattedDescription,
            labels: ticket.labels,
            milestone: milestoneId || undefined,
          }

          const createdPlatformTicket = await client.createTicket(projectId, platformTicket)
          
          // Save to database with platform info
          const [dbTicket] = await db.insert(tickets).values({
            conversationId,
            platformId,
            externalId: createdPlatformTicket.id,
            externalUrl: createdPlatformTicket.url,
            title: ticket.title,
            description: ticket.description,
            acceptanceCriteria: JSON.stringify(ticket.acceptanceCriteria),
            tasks: JSON.stringify(ticket.tasks),
            labels: JSON.stringify(ticket.labels),
            priority: ticket.priority,
            status: 'created',
          }).returning()

          createdTickets.push(dbTicket)
          platformTickets.push(createdPlatformTicket)
        } catch (error) {
          console.error('Failed to create ticket on platform:', error)
          // Save as failed ticket
          const [dbTicket] = await db.insert(tickets).values({
            conversationId,
            platformId,
            title: ticket.title,
            description: ticket.description,
            acceptanceCriteria: JSON.stringify(ticket.acceptanceCriteria),
            tasks: JSON.stringify(ticket.tasks),
            labels: JSON.stringify(ticket.labels),
            priority: ticket.priority,
            status: 'failed',
          }).returning()
          
          createdTickets.push(dbTicket)
        }
      }
    } else {
      // Create tickets in database only (draft mode)
      for (const ticket of ticketData) {
        const [dbTicket] = await db.insert(tickets).values({
          conversationId,
          platformId,
          title: ticket.title,
          description: ticket.description,
          acceptanceCriteria: JSON.stringify(ticket.acceptanceCriteria),
          tasks: JSON.stringify(ticket.tasks),
          labels: JSON.stringify(ticket.labels),
          priority: ticket.priority,
          status: 'draft',
        }).returning()
        
        createdTickets.push(dbTicket)
      }
    }
    
    return c.json({ 
      tickets: createdTickets,
      platformTickets: platformTickets,
      success: true,
      message: platformTickets.length > 0 
        ? `Successfully created ${platformTickets.length} tickets!`
        : `Saved ${createdTickets.length} tickets as drafts.`
    })
  } catch (error) {
    console.error('Ticket creation error:', error)
    return c.json({ error: 'Failed to create tickets' }, 500)
  }
})

// Platform routes
app.get('/api/protected/platforms', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    
    const userPlatforms = await db.query.platforms.findMany({
      where: (platforms, { eq }) => eq(platforms.userId, payload.userId),
      orderBy: (platforms, { desc }) => [desc(platforms.createdAt)]
    })
    
    return c.json(userPlatforms)
  } catch (error) {
    console.error('Platforms fetch error:', error)
    return c.json({ error: 'Failed to fetch platforms' }, 500)
  }
})

app.post('/api/protected/platforms', zValidator('json', platformSchema), async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const { name, type, baseUrl, token } = c.req.valid('json')
    
    // Set default baseUrl for GitHub
    const finalBaseUrl = type === 'github' ? 'https://api.github.com' : (baseUrl || '')
    
    console.log('Received platform data:', { name, type, baseUrl: finalBaseUrl, token: '***' })
    
    // Test connection first
    let client: any
    let isConnected = false
    
    try {
      if (type === 'gitlab') {
        client = new GitLabClient(finalBaseUrl, token)
      } else {
        // GitHub client only needs token, not baseUrl
        client = new GitHubClient(token)
      }
      isConnected = await client.testConnection()
    } catch (error) {
      console.error('Connection test failed:', error)
      return c.json({ error: 'Invalid credentials or connection failed' }, 400)
    }
    
    // Create platform in database
    const [platform] = await db.insert(platforms).values({
      userId: payload.userId,
      name: `${type.toUpperCase()}: ${name}`,
      apiUrl: finalBaseUrl,
      accessToken: token, // In production, encrypt this!
      isActive: isConnected,
    }).returning()
    
    return c.json(platform)
  } catch (error) {
    console.error('Platform creation error:', error)
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors)
      return c.json({ error: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` }, 400)
    }
    return c.json({ error: 'Failed to create platform' }, 500)
  }
})

app.post('/api/protected/platforms/:id/test', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const platformId = c.req.param('id')
    
    // Get platform
    const platform = await db.query.platforms.findFirst({
      where: (platforms, { eq, and }) => and(
        eq(platforms.id, platformId),
        eq(platforms.userId, payload.userId)
      )
    })
    
    if (!platform) {
      return c.json({ error: 'Platform not found' }, 404)
    }
    
    // Determine type from name (since we store it there)
    const isGitLab = platform.name.startsWith('GITLAB:')
    
    // Create client and test connection
    let client: any
    if (isGitLab) {
      client = new GitLabClient(platform.apiUrl, platform.accessToken)
    } else {
      client = new GitHubClient(platform.accessToken)
    }
    
    const isConnected = await client.testConnection()
    
    // Update isActive status
    await db.update(platforms)
      .set({ isActive: isConnected })
      .where(eq(platforms.id, platformId))
    
    return c.json({ connected: isConnected })
  } catch (error) {
    console.error('Platform test error:', error)
    return c.json({ error: 'Failed to test platform connection' }, 500)
  }
})

app.delete('/api/protected/platforms/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const platformId = c.req.param('id')
    
    // Verify platform ownership and delete
    const result = await db.delete(platforms)
      .where(and(
        eq(platforms.id, platformId),
        eq(platforms.userId, payload.userId)
      ))
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Platform deletion error:', error)
    return c.json({ error: 'Failed to delete platform' }, 500)
  }
})

// Get projects for a platform
app.get('/api/protected/platforms/:id/projects', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const platformId = c.req.param('id')
    
    // Get platform
    const platform = await db.query.platforms.findFirst({
      where: (platforms, { eq, and }) => and(
        eq(platforms.id, platformId),
        eq(platforms.userId, payload.userId)
      )
    })
    
    if (!platform) {
      return c.json({ error: 'Platform not found' }, 404)
    }
    
    // Determine type from name
    const isGitLab = platform.name.startsWith('GITLAB:')
    
    // Create client and fetch projects
    let client: any
    if (isGitLab) {
      client = new GitLabClient(platform.apiUrl, platform.accessToken)
    } else {
      client = new GitHubClient(platform.accessToken)
    }
    
    const projects = await client.getProjects()
    return c.json(projects)
  } catch (error) {
    console.error('Projects fetch error:', error)
    return c.json({ error: 'Failed to fetch projects' }, 500)
  }
})

// Get milestones for a project
app.get('/api/protected/platforms/:id/projects/:projectId/milestones', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const platformId = c.req.param('id')
    const projectId = c.req.param('projectId')
    
    // Get platform
    const platform = await db.query.platforms.findFirst({
      where: (platforms, { eq, and }) => and(
        eq(platforms.id, platformId),
        eq(platforms.userId, payload.userId)
      )
    })
    
    if (!platform) {
      return c.json({ error: 'Platform not found' }, 404)
    }
    
    // Only GitLab has milestones
    const isGitLab = platform.name.startsWith('GITLAB:')
    if (!isGitLab) {
      return c.json([]) // GitHub doesn't have milestones in the same way
    }
    
    const client = new GitLabClient(platform.apiUrl, platform.accessToken)
    const milestones = await client.getMilestones(projectId)
    return c.json(milestones)
  } catch (error) {
    console.error('Milestones fetch error:', error)
    return c.json({ error: 'Failed to fetch milestones' }, 500)
  }
})

// Delete individual conversation
app.delete('/api/protected/conversations/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload')
    const conversationId = c.req.param('id')
    
    // Verify conversation ownership and delete
    const result = await db.delete(conversations)
      .where(and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, payload.userId)
      ))
    
    return c.json({ success: true, message: 'Conversation deleted successfully' })
  } catch (error) {
    console.error('Conversation deletion error:', error)
    return c.json({ error: 'Failed to delete conversation' }, 500)
  }
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
const port = parseInt(process.env.PORT || '3000')
serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 Server is running on http://localhost:${info.port}`)
  console.log(`📊 Available AI providers: ${aiService.getAvailableProviders().join(', ')}`)
})