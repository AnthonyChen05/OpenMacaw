import type { LLMProvider, Message, ToolDefinition, StreamDelta } from './provider.js';
import { getConfig } from '../config.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  models = [
    'llama3.1',
    'llama3',
    'mistral',
    'codellama',
    'phi3',
  ];

  private baseUrl: string;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.OLLAMA_BASE_URL;
  }

  async chat(
    model: string,
    messages: Message[],
    _tools: ToolDefinition[],
    onDelta: (delta: StreamDelta) => void
  ): Promise<{ inputTokens: number; outputTokens: number }> {
    const ollamaMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: `Tool ${msg.toolName} result: ${msg.content}`,
        };
      }
      return {
        role: msg.role === 'system' ? 'system' as const : msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    });

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let inputTokens = 0;
    let outputTokens = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            onDelta({
              type: 'text_delta',
              content: data.message.content,
            });
          }
          if (data.done) {
            inputTokens = data.prompt_eval_count || 0;
            outputTokens = data.eval_count || 0;
            onDelta({
              type: 'message_end',
              usage: { inputTokens, outputTokens },
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return { inputTokens, outputTokens };
  }
}
