import type {
  AIProvider,
  AIMessage,
  AIResponse,
  TicketData,
  StructuredAIResponse,
} from './types.js';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'mistral') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateResponse(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse> {
    try {
      // Convert messages to Ollama format
      let prompt = '';

      if (systemPrompt) {
        prompt += `System: ${systemPrompt}\n\n`;
      }

      // Build conversation prompt
      for (const message of messages) {
        if (message.role === 'system') continue; // Already handled above
        const roleLabel = message.role === 'user' ? 'Human' : 'Assistant';
        prompt += `${roleLabel}: ${message.content}\n\n`;
      }

      prompt += 'Assistant:';

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.response;

      // Try to parse as structured JSON response first
      if (
        systemPrompt &&
        (systemPrompt.includes('CRITICAL: JSON Response Format') || systemPrompt.includes('ticket'))
      ) {
        try {
          // Look for JSON in the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed: StructuredAIResponse = JSON.parse(jsonMatch[0]);
            return {
              content: parsed.message,
              tickets: parsed.tickets,
              shouldSplit: parsed.shouldSplit,
              clarificationNeeded: parsed.clarificationNeeded,
            };
          }
        } catch (parseError) {
          console.warn('Failed to parse Ollama structured response, falling back to plain text');
        }
      }

      // Fallback to plain text response
      return {
        content: content,
      };
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(
        `Failed to generate response from Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async parseTickets(input: string): Promise<TicketData[]> {
    // For Ollama, we'll try to extract tickets from the response
    // This is a simplified implementation - in a real scenario you might
    // want to make another API call specifically for ticket parsing
    try {
      const prompt = `Extract development tickets from the following text and return them as a JSON array of objects with this structure:
{
  "title": "string",
  "description": "string", 
  "acceptanceCriteria": ["string"],
  "tasks": ["string"],
  "labels": ["string"],
  "priority": "low|medium|high|critical"
}

Text to analyze:
${input}

Return only the JSON array, no other text:`;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            max_tokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const tickets = JSON.parse(data.response);
      return Array.isArray(tickets) ? tickets : [];
    } catch (error) {
      console.error('Error parsing tickets with Ollama:', error);
      return [];
    }
  }

  // Method to check if Ollama is running and the model is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.models || [];
      return models.some((model: any) => model.name.startsWith(this.model));
    } catch (error) {
      return false;
    }
  }

  // Method to list available models
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models || [];
      return models.map((model: any) => model.name);
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  }
}
