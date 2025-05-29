import { GoogleGenAI } from '@google/genai';
import type { AIProvider, AIMessage, AIResponse, TicketData } from './types.js';

export class GoogleProvider implements AIProvider {
  name = 'google';
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    try {
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Add system prompt as first message if provided
      if (systemPrompt) {
        contents.unshift({
          role: 'user',
          parts: [{ text: systemPrompt }]
        });
        // Add a model acknowledgment
        contents.push({
          role: 'model',
          parts: [{ text: 'I understand. I will help you create well-structured tickets based on your requirements.' }]
        });
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents
      });

      const content = response.text || '';
      
      // Parse the response to extract tickets and other structured data
      const tickets = await this.parseTickets(content);
      
      return {
        content,
        tickets,
        shouldSplit: tickets.length > 1,
        clarificationNeeded: content.includes('need more information') || content.includes('clarification'),
      };
    } catch (error) {
      console.error('Google AI API error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async parseTickets(input: string): Promise<TicketData[]> {
    console.log('=== PARSING TICKETS DEBUG ===');
    console.log('Input length:', input.length);
    console.log('Input preview:', input.substring(0, 500));
    console.log('Looking for patterns...');
    
    const tickets: TicketData[] = [];
    
    // Split the input by user story markers - try multiple patterns
    let storyPattern = /-{5,}\s*#\s*User Story/gi;
    let stories = input.split(storyPattern);
    console.log('Pattern 1 (dashes + # User Story) found:', stories.length - 1, 'stories');
    
    // If the primary pattern doesn't work, try alternative patterns
    if (stories.length <= 1) {
      // Try numbered user stories
      storyPattern = /(\d+\.\s*\*\*[^*]+\*\*:)/gi;
      const matches = [...input.matchAll(storyPattern)];
      console.log('Pattern 2 (numbered bold) found:', matches.length, 'matches');
      if (matches.length > 0) {
        stories = [];
        let lastIndex = 0;
        for (const match of matches) {
          if (lastIndex < match.index!) {
            stories.push(input.substring(lastIndex, match.index));
          }
          lastIndex = match.index!;
        }
        if (lastIndex < input.length) {
          stories.push(input.substring(lastIndex));
        }
        console.log('Created', stories.length, 'story sections from numbered pattern');
      }
    }
    
    // If still no stories found, try to extract based on bullet points or structured content
    if (stories.length <= 1) {
      // Try bullet points with bold text
      const bulletPattern = /\*\s*\*\*([^*:]+)(?:\*\*:|:)/gi;
      const bulletMatches = [...input.matchAll(bulletPattern)];
      console.log('Pattern 3 (bullet + bold) found:', bulletMatches.length, 'matches');
      if (bulletMatches.length > 0) {
        // Create stories from bullet points
        for (let i = 0; i < bulletMatches.length; i++) {
          const match = bulletMatches[i];
          const title = match[1].trim();
          // Find content until next bullet or end
          const startIndex = match.index! + match[0].length;
          const nextMatch = bulletMatches[i + 1];
          const endIndex = nextMatch ? nextMatch.index! : input.length;
          const content = input.substring(startIndex, endIndex);
          
          console.log(`Bullet ${i + 1}: Title="${title}", Content preview="${content.substring(0, 100)}..."`);
          
          const ticket = this.parseUserStoryFromContent(title, content);
          if (ticket) tickets.push(ticket);
        }
        console.log('Generated', tickets.length, 'tickets from bullet pattern');
        return tickets;
      }
    }
    
    // Try pattern for "Story 1:", "Story 2:", etc.
    if (stories.length <= 1) {
      const storyNumPattern = /Story\s+\d+:\s*([^:\n]+)/gi;
      const storyMatches = [...input.matchAll(storyNumPattern)];
      console.log('Pattern 4 (Story N:) found:', storyMatches.length, 'matches');
      if (storyMatches.length > 0) {
        for (let i = 0; i < storyMatches.length; i++) {
          const match = storyMatches[i];
          const title = match[1].trim();
          const startIndex = match.index! + match[0].length;
          const nextMatch = storyMatches[i + 1];
          const endIndex = nextMatch ? nextMatch.index! : input.length;
          const content = input.substring(startIndex, endIndex);
          
          console.log(`Story ${i + 1}: Title="${title}", Content preview="${content.substring(0, 100)}..."`);
          
          const ticket = this.parseUserStoryFromContent(title, content);
          if (ticket) tickets.push(ticket);
        }
        console.log('Generated', tickets.length, 'tickets from Story N pattern');
        return tickets;
      }
    }
    
    // Skip the first element if it's just intro text
    const actualStories = stories.length > 1 ? stories.slice(1) : stories;
    console.log('Processing', actualStories.length, 'actual story sections');
    
    if (actualStories.length === 0) {
      // Fallback: Look for any structured content that might be a user story
      console.log('No patterns found, using fallback parsing');
      const fallbackTicket = this.parseUnstructuredContent(input);
      if (fallbackTicket) tickets.push(fallbackTicket);
      return tickets;
    }
    
    actualStories.forEach((story, index) => {
      console.log(`Processing story ${index + 1}:`, story.substring(0, 100) + '...');
      const ticket = this.parseUserStory(story);
      if (ticket) {
        tickets.push(ticket);
        console.log(`Successfully parsed story ${index + 1}: "${ticket.title}"`);
      } else {
        console.log(`Failed to parse story ${index + 1}`);
      }
    });
    
    console.log('=== FINAL RESULT: Generated', tickets.length, 'tickets ===');
    return tickets;
  }

  private parseUserStory(storyText: string): TicketData | null {
    try {
      // Extract title
      const titleMatch = storyText.match(/##\s*Title:\s*\n?\*?([^*\n]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Generated User Story';
      
      // Extract description (As a... I want... so that...)
      const descMatch = storyText.match(/##\s*Description:\s*\n?\*?([^*]+?)(?=##|$)/is);
      const description = descMatch ? descMatch[1].trim() : `User story for: ${title}`;
      
      // Extract acceptance criteria
      const criteriaMatch = storyText.match(/##\s*Acceptance Criteria:\s*\n?([\s\S]*?)(?=##|$)/i);
      const acceptanceCriteria: string[] = [];
      if (criteriaMatch) {
        const criteriaText = criteriaMatch[1];
        const criteriaLines = criteriaText.match(/\d+\.\s*\*?([^*\n]+)/g);
        if (criteriaLines) {
          criteriaLines.forEach(line => {
            const cleaned = line.replace(/^\d+\.\s*\*?/, '').trim();
            if (cleaned) acceptanceCriteria.push(cleaned);
          });
        }
      }
      
      // Extract tasks
      const tasksMatch = storyText.match(/##\s*Tasks:\s*\n?([\s\S]*?)(?=##|$)/i);
      const tasks: string[] = [];
      if (tasksMatch) {
        const tasksText = tasksMatch[1];
        const taskLines = tasksText.match(/[-*]\s*\[\s*\]\s*\*?([^*\n]+)/g);
        if (taskLines) {
          taskLines.forEach(line => {
            const cleaned = line.replace(/^[-*]\s*\[\s*\]\s*\*?/, '').trim();
            if (cleaned) tasks.push(cleaned);
          });
        }
      }
      
      // Extract additional notes for labels
      const notesMatch = storyText.match(/##\s*Additional Notes:\s*\n?\*?([^*]+?)(?=##|$)/is);
      const additionalNotes = notesMatch ? notesMatch[1].trim() : '';
      
      // Generate labels based on content
      const labels = this.generateLabels(title, description, additionalNotes);
      
      // Determine priority based on content
      const priority = this.determinePriority(title, description, additionalNotes);
      
      return {
        title,
        description,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : ['Story implementation completed', 'Acceptance testing passed'],
        tasks: tasks.length > 0 ? tasks : ['Implement story requirements', 'Test functionality', 'Code review'],
        labels,
        priority
      };
    } catch (error) {
      console.error('Error parsing user story:', error);
      return null;
    }
  }

  private parseUserStoryFromContent(title: string, content: string): TicketData | null {
    try {
      // Clean the title
      const cleanTitle = title.replace(/^\d+\.\s*/, '').trim();
      
      // Use content as description, or create one from title
      const description = content.trim() || `As a user, I want ${cleanTitle.toLowerCase()} so that I can improve the system functionality.`;
      
      // Extract any criteria or tasks from content
      const acceptanceCriteria: string[] = [];
      const tasks: string[] = [];
      
      // Look for numbered or bulleted lists
      const criteriaMatches = content.match(/\d+\.\s*[^\n]+/g) || [];
      criteriaMatches.forEach(match => {
        const cleaned = match.replace(/^\d+\.\s*/, '').trim();
        if (cleaned && !cleaned.includes('Task')) {
          acceptanceCriteria.push(cleaned);
        }
      });
      
      // Look for task-like content
      const taskMatches = content.match(/[-*]\s*[^\n]+/g) || [];
      taskMatches.forEach(match => {
        const cleaned = match.replace(/^[-*]\s*/, '').trim();
        if (cleaned) {
          tasks.push(cleaned);
        }
      });
      
      // Generate labels based on content
      const labels = this.generateLabels(cleanTitle, content, '');
      
      // Determine priority based on content
      const priority = this.determinePriority(cleanTitle, content, '');
      
      return {
        title: cleanTitle,
        description,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : ['Implementation completed successfully', 'Functionality tested and verified'],
        tasks: tasks.length > 0 ? tasks : ['Analyze requirements', 'Implement solution', 'Test and validate'],
        labels,
        priority
      };
    } catch (error) {
      console.error('Error parsing user story from content:', error);
      return null;
    }
  }

  private parseUnstructuredContent(input: string): TicketData | null {
    // Fallback parsing for when content doesn't match the expected format
    const title = input.split('\n')[0]?.trim() || 'Generated User Story';
    
    return {
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      description: `As a user, I want to implement the requirements described in: ${input.substring(0, 200)}...`,
      acceptanceCriteria: ['Story requirements are met', 'Functionality works as expected'],
      tasks: ['Analyze requirements', 'Implement solution', 'Test and validate'],
      labels: ['user-story', 'ai-generated'],
      priority: 'medium'
    };
  }

  private generateLabels(title: string, description: string, notes: string): string[] {
    const content = `${title} ${description} ${notes}`.toLowerCase();
    const labels = ['user-story'];
    
    // Add labels based on content analysis
    if (content.includes('frontend') || content.includes('ui') || content.includes('interface')) labels.push('frontend');
    if (content.includes('backend') || content.includes('api') || content.includes('server')) labels.push('backend');
    if (content.includes('database') || content.includes('db')) labels.push('database');
    if (content.includes('auth') || content.includes('login') || content.includes('security')) labels.push('authentication');
    if (content.includes('test') || content.includes('testing')) labels.push('testing');
    if (content.includes('bug') || content.includes('fix')) labels.push('bug');
    else labels.push('feature');
    
    return labels;
  }

  private determinePriority(title: string, description: string, notes: string): 'low' | 'medium' | 'high' | 'critical' {
    const content = `${title} ${description} ${notes}`.toLowerCase();
    
    if (content.includes('critical') || content.includes('urgent') || content.includes('security')) return 'critical';
    if (content.includes('important') || content.includes('high priority')) return 'high';
    if (content.includes('low priority') || content.includes('nice to have')) return 'low';
    
    return 'medium';
  }
} 