/**
 * AIDE Stream Simulator
 * 
 * Simulates streaming responses from the AIDE API which only supports
 * non-streaming requests. Chunks text word-by-word for natural display.
 */

import type { LanguageModelV3StreamPart, LanguageModelV3Usage, LanguageModelV3FinishReason } from '@ai-sdk/provider';

export interface StreamSimulatorOptions {
  /** The full text response to stream */
  text: string;
  /** Unique ID for this text block */
  textId: string;
  /** Tool calls from the response */
  toolCalls?: Array<{
    id: string;
    name: string;
    input: string;
  }>;
  /** Usage information */
  usage: LanguageModelV3Usage;
  /** Finish reason */
  finishReason: LanguageModelV3FinishReason;
  /** Model ID for response metadata */
  modelId: string;
  /** Warnings to include in stream-start */
  warnings?: Array<{ type: string; message: string }>;
  /** Request ID from AIDE */
  requestId?: string;
}

/**
 * Split text into words while preserving whitespace
 * Returns array of [word, trailingWhitespace] pairs
 */
function splitIntoWords(text: string): Array<{ word: string; whitespace: string }> {
  const result: Array<{ word: string; whitespace: string }> = [];
  const regex = /(\S+)(\s*)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    result.push({
      word: match[1],
      whitespace: match[2],
    });
  }

  return result;
}

/**
 * Create a ReadableStream that simulates streaming the response word-by-word
 */
export function createSimulatedStream(options: StreamSimulatorOptions): ReadableStream<LanguageModelV3StreamPart> {
  const {
    text,
    textId,
    toolCalls = [],
    usage,
    finishReason,
    modelId,
    warnings = [],
    requestId,
  } = options;

  const words = splitIntoWords(text);
  let wordIndex = 0;
  let toolCallIndex = 0;
  let phase: 'start' | 'text-start' | 'text-delta' | 'text-end' | 'tools' | 'metadata' | 'finish' | 'done' = 'start';

  return new ReadableStream<LanguageModelV3StreamPart>({
    pull(controller) {
      switch (phase) {
        case 'start': {
          // Emit stream-start with warnings
          // Map warnings to the correct SharedV3Warning format
          const mappedWarnings = warnings.map(w => {
            if (w.type === 'unsupported-setting') {
              return { type: 'unsupported' as const, feature: w.message };
            }
            return { type: 'other' as const, message: w.message };
          });
          controller.enqueue({
            type: 'stream-start',
            warnings: mappedWarnings,
          });
          phase = text.length > 0 ? 'text-start' : (toolCalls.length > 0 ? 'tools' : 'metadata');
          break;
        }

        case 'text-start': {
          // Emit text-start
          controller.enqueue({
            type: 'text-start',
            id: textId,
          });
          phase = 'text-delta';
          break;
        }

        case 'text-delta': {
          if (wordIndex < words.length) {
            // Emit next word with its trailing whitespace
            const { word, whitespace } = words[wordIndex];
            controller.enqueue({
              type: 'text-delta',
              id: textId,
              delta: word + whitespace,
            });
            wordIndex++;
          } else {
            // Done with text
            phase = 'text-end';
          }
          break;
        }

        case 'text-end': {
          controller.enqueue({
            type: 'text-end',
            id: textId,
          });
          phase = toolCalls.length > 0 ? 'tools' : 'metadata';
          break;
        }

        case 'tools': {
          if (toolCallIndex < toolCalls.length) {
            const tool = toolCalls[toolCallIndex];
            
            // Emit tool-input-start
            controller.enqueue({
              type: 'tool-input-start',
              id: tool.id,
              toolName: tool.name,
            });

            // Emit tool-input-delta with full args
            controller.enqueue({
              type: 'tool-input-delta',
              id: tool.id,
              delta: tool.input,
            });

            // Emit tool-input-end
            controller.enqueue({
              type: 'tool-input-end',
              id: tool.id,
            });

            // Emit the actual tool-call
            controller.enqueue({
              type: 'tool-call',
              toolCallId: tool.id,
              toolName: tool.name,
              input: tool.input,
            });

            toolCallIndex++;
          } else {
            phase = 'metadata';
          }
          break;
        }

        case 'metadata': {
          // Emit response metadata
          controller.enqueue({
            type: 'response-metadata',
            modelId,
            id: requestId,
          });
          phase = 'finish';
          break;
        }

        case 'finish': {
          // Emit finish with usage and finish reason
          controller.enqueue({
            type: 'finish',
            usage,
            finishReason,
          });
          phase = 'done';
          break;
        }

        case 'done': {
          controller.close();
          break;
        }
      }
    },
  });
}

/**
 * Create a stream that immediately errors
 */
export function createErrorStream(error: Error): ReadableStream<LanguageModelV3StreamPart> {
  return new ReadableStream<LanguageModelV3StreamPart>({
    start(controller) {
      controller.enqueue({
        type: 'stream-start',
        warnings: [],
      });
      controller.enqueue({
        type: 'error',
        error,
      });
      controller.close();
    },
  });
}
