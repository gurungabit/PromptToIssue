import OpenAI from 'openai';
import type { AIProvider, AIMessage, AIResponse, TicketData } from './types.js';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }
    
    openaiMessages.push(...messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    })));

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Try to parse tickets from the response
      const tickets = await this.parseTickets(content);
      
      return {
        content,
        tickets: tickets.length > 0 ? tickets : undefined,
        shouldSplit: tickets.length > 1,
        clarificationNeeded: content.toLowerCase().includes('clarif') || content.includes('?')
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async parseTickets(input: string): Promise<TicketData[]> {
    const ticketParsingPrompt = `
Parse the following text and extract ticket information. Return a JSON array of tickets.
Each ticket should have: title, description, acceptanceCriteria (array), tasks (array), labels (array), priority.

Text to parse:
${input}

Return only valid JSON array. If no tickets are found, return empty array.
`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: ticketParsingPrompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '[]';
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return [];
    } catch (error) {
      console.error('Error parsing tickets:', error);
      return [];
    }
  }
} 