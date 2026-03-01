import type { LLMProvider, ProviderType } from './provider.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { getConfig } from '../config.js';

const providers: Map<ProviderType, LLMProvider> = new Map();

export function getProvider(type?: ProviderType): LLMProvider {
  const config = getConfig();
  const providerType = type || config.DEFAULT_PROVIDER as ProviderType;

  if (providers.has(providerType)) {
    return providers.get(providerType)!;
  }

  let provider: LLMProvider;

  switch (providerType) {
    case 'anthropic':
      provider = new AnthropicProvider();
      break;
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'ollama':
      provider = new OllamaProvider();
      break;
    default:
      throw new Error(`Unknown provider: ${providerType}`);
  }

  providers.set(providerType, provider);
  return provider;
}

export function getAvailableProviders(): ProviderType[] {
  return ['anthropic', 'openai', 'ollama'];
}

export { type LLMProvider, type Message, type ToolDefinition, type StreamDelta, type ToolCall };
