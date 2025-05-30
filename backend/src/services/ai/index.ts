import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import type { AIProvider, AIProviderType, AIMessage, AIResponse } from './types.js';
import { z } from 'zod';

export class AIService {
  private providers: Map<AIProviderType, AIProvider> = new Map();

  constructor(apiKeys: Partial<Record<AIProviderType, string>>) {
    if (apiKeys.openai) {
      this.providers.set('openai', new OpenAIProvider(apiKeys.openai));
    }
    if (apiKeys.anthropic) {
      this.providers.set('anthropic', new AnthropicProvider(apiKeys.anthropic));
    }
    if (apiKeys.google) {
      this.providers.set('google', new GoogleProvider(apiKeys.google));
    }
  }

  getProvider(type: AIProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  async generateResponse(
    providerType: AIProviderType,
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`AI provider ${providerType} not configured`);
    }

    return provider.generateResponse(messages, systemPrompt);
  }

  async generateResponseWithFallback(
    preferredProvider: AIProviderType,
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    // Try preferred provider first
    try {
      return await this.generateResponse(preferredProvider, messages, systemPrompt);
    } catch (error) {
      console.warn(`Primary provider ${preferredProvider} failed:`, error);
      
      // Try fallback providers
      const fallbackProviders = this.getAvailableProviders()
        .filter(p => p !== preferredProvider);
      
      for (const provider of fallbackProviders) {
        try {
          console.log(`Trying fallback provider: ${provider}`);
          return await this.generateResponse(provider, messages, systemPrompt);
        } catch (fallbackError) {
          console.warn(`Fallback provider ${provider} failed:`, fallbackError);
        }
      }
      
      throw new Error('All AI providers failed');
    }
  }
}

export const SYSTEM_PROMPT = `
You are an expert AI assistant specialized in Agile software development and user story creation.

## CRITICAL: JSON Response Format
You MUST respond with ONLY valid JSON that conforms to this EXACT Zod schema:

\`\`\`typescript
const StructuredAIResponseSchema = z.object({
  message: z.string().min(1),
  tickets: z.array(TicketSchema).optional(),
  shouldSplit: z.boolean().optional().default(false),
  clarificationNeeded: z.boolean().optional().default(false)
});

const TicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  acceptanceCriteria: z.array(z.string()),
  tasks: z.array(z.string()),
  labels: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high', 'critical'])
});
\`\`\`

## CRITICAL JSON FORMATTING RULES:
1. **NO literal newlines in JSON strings** - Use \\n for line breaks
2. **NO markdown code blocks** - Send raw JSON only
3. **Use regular ASCII dashes (-)** not Unicode bullets
4. **Escape special characters properly**
5. **Must pass JSON.parse() validation**

## Example Responses:

**For general questions:**
{
  "message": "I can help with:\\n\\n1. Technical questions\\n2. Create development tickets\\n3. Architecture advice\\n\\nWhat would you like help with?"
}

**For development requests:**
{
  "message": "I've created user stories for your authentication system.",
  "tickets": [
    {
      "title": "Setup Project Dependencies",
      "description": "As a developer, I want to setup authentication dependencies so I can implement user login.",
      "acceptanceCriteria": ["Project initialized", "Dependencies installed", "Configuration complete"],
      "tasks": ["Initialize project", "Install packages", "Configure environment"],
      "labels": ["backend", "setup"],
      "priority": "high"
    }
  ]
}

**For clarification needed:**
{
  "message": "I can create search functionality tickets. Please specify:\\n\\n- What data to search?\\n- Where to implement (web/mobile)?\\n- Features needed (filters, sorting)?",
  "clarificationNeeded": true
}

## Your Capabilities:
- Answer technical questions and provide guidance
- Transform requirements into structured user stories
- Break down complex features into manageable tasks
- Provide development best practices

## Response Guidelines:
- For general questions: Only include "message" field
- For development needs: Include "message" and "tickets" array
- For unclear requests: Set "clarificationNeeded": true
- Always use \\n for line breaks in strings, never literal newlines
- Keep responses conversational but structured

REMEMBER: Your response must be valid JSON that passes both JSON.parse() and the Zod schema validation above.
`;

export * from './types.js'; 