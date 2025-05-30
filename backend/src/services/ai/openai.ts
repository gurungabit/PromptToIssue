import OpenAI from 'openai';
import type {
  AIProvider,
  AIMessage,
  AIResponse,
  TicketData,
  StructuredAIResponse,
} from './types.js';
import { StructuredAIResponseSchema } from './schemas.js';

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

    openaiMessages.push(
      ...messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }))
    );

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content || '';
      console.log('Raw OpenAI response:', content);

      // Try to parse as structured JSON response
      const structuredResponse = this.parseStructuredResponse(content);

      if (structuredResponse) {
        return {
          content: structuredResponse.message,
          tickets: structuredResponse.tickets,
          shouldSplit: structuredResponse.shouldSplit || false,
          clarificationNeeded: structuredResponse.clarificationNeeded || false,
        };
      } else {
        // Fallback to old parsing if JSON parsing fails
        console.log('JSON parsing failed, falling back to text parsing');
        const tickets = await this.parseTickets(content);
        return {
          content,
          tickets: tickets.length > 0 ? tickets : undefined,
          shouldSplit: tickets.length > 1,
          clarificationNeeded: content.toLowerCase().includes('clarif') || content.includes('?'),
        };
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private parseStructuredResponse(content: string): StructuredAIResponse | null {
    try {
      // Extract JSON from the response - it might be wrapped in markdown code blocks
      let jsonContent = content.trim();

      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to find JSON object in the text - look for the first { and last }
      const startIndex = jsonContent.indexOf('{');
      const lastIndex = jsonContent.lastIndexOf('}');

      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        jsonContent = jsonContent.substring(startIndex, lastIndex + 1);
      }

      const parsed = JSON.parse(jsonContent);

      // Validate with Zod schema
      const validatedResponse = StructuredAIResponseSchema.parse(parsed);

      return {
        message: validatedResponse.message,
        tickets: validatedResponse.tickets,
        shouldSplit: validatedResponse.shouldSplit,
        clarificationNeeded: validatedResponse.clarificationNeeded,
      };
    } catch (error) {
      console.error('Failed to parse structured response:', error);
      return null;
    }
  }

  async parseTickets(input: string): Promise<TicketData[]> {
    // First, check if the response is asking for clarification or contains questions
    const isAskingForClarification =
      input.includes('clarif') ||
      input.includes('Could you please') ||
      input.includes('let me know') ||
      input.includes('specify') ||
      input.includes('need more information') ||
      input.includes('unclear') ||
      input.includes('?') ||
      input.toLowerCase().includes('what kind of') ||
      input.toLowerCase().includes('which features') ||
      input.toLowerCase().includes('more details');

    // If asking for clarification, don't try to extract tickets
    if (isAskingForClarification) {
      console.log('OpenAI response is asking for clarification - not extracting tickets');
      return [];
    }

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
