import type { LLMProvider, ProviderType, Message, ToolDefinition, StreamDelta, ToolCall } from './provider.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { getConfig } from '../config.js';
import { getDb, schema } from '../db/index.js';

const providers: Map<ProviderType, LLMProvider> = new Map();

export function getProvider(type?: ProviderType): LLMProvider {
  const config = getConfig();
  let providerType = type;

  if (!providerType) {
    try {
      const db = getDb();
      const settings = db.select(schema.settings as any).where().all() as any[];
      const defaultProviderSetting = settings.find((s: any) => s.key === 'DEFAULT_PROVIDER');
      if (defaultProviderSetting?.value) {
        providerType = defaultProviderSetting.value as ProviderType;
      }
    } catch (e) {
      // Ignore if DB is not initialized yet
    }
  }

  providerType = providerType || (config.DEFAULT_PROVIDER as ProviderType);

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
