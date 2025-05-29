import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIMessage, AIResponse, TicketData } from './types.js';

export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages.filter(msg => msg.role !== 'system').map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      // Try to parse tickets from the response
      const tickets = await this.parseTickets(content);
      
      return {
        content,
        tickets: tickets.length > 0 ? tickets : undefined,
        shouldSplit: tickets.length > 1,
        clarificationNeeded: content.toLowerCase().includes('clarif') || content.includes('?')
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
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
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{ role: 'user', content: ticketParsingPrompt }]
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
      
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