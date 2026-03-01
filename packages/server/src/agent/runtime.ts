import { getProvider, type Message, type ToolDefinition, type StreamDelta, type ToolCall } from '../llm/index.js';
import { getAllTools, getMCPServer } from '../mcp/registry.js';
import { evaluatePermission, extractServerIdFromToolName } from '../permissions/index.js';
import { getConfig } from '../config.js';
import { getDb, schema } from '../db/index.js';
import { nanoid } from 'nanoid';

export type AgentMode = 'build' | 'plan';

export interface AgentConfig {
  sessionId: string;
  model: string;
  systemPrompt?: string;
  mode: AgentMode;
  maxSteps: number;
}

export type EventHandler = (event: AgentEvent) => void;

export type AgentEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call_start'; tool: string; server: string; input: Record<string, unknown> }
  | { type: 'tool_call_result'; outcome: 'allowed' | 'denied'; result?: unknown; reason?: string }
  | { type: 'message_end'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; message: string }
  | { type: 'step_count'; count: number };

export class AgentRuntime {
  private config: AgentConfig;
  private messages: Message[] = [];
  private eventHandler: EventHandler;
  private stepCount = 0;
  private maxSteps: number;

  constructor(config: AgentConfig, eventHandler: EventHandler) {
    this.config = config;
    this.eventHandler = eventHandler;
    this.maxSteps = config.maxSteps || getConfig().MAX_STEPS;

    if (config.systemPrompt) {
      this.messages.push({ role: 'system', content: config.systemPrompt });
    }
  }

  private loadHistory(): void {
    const db = getDb();
    const history = db.select(schema.messages as any)
      .where((getCol: (col: string) => any) => getCol('sessionId') === this.config.sessionId)
      .all() as any[];

    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        this.messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    if (history.length > 0) {
      console.log(`[Agent] Loaded ${history.length} messages from history`);
    }
  }

  async run(userMessage: string): Promise<void> {
    console.log('[Agent] Received user message:', userMessage.substring(0, 50));

    // Load conversation history so Claude has context from previous turns
    this.loadHistory();

    this.messages.push({ role: 'user', content: userMessage });

    await this.saveMessage('user', userMessage);

    while (this.stepCount < this.maxSteps) {
      const tools = getAllTools();
      console.log('[Agent] Available tools:', tools.length);
      
      const provider = getProvider();
      
      let deltaText = '';
      
      const result = await provider.chat(
        this.config.model,
        this.messages,
        tools,
        (delta: StreamDelta) => {
          if (delta.type === 'text_delta' && delta.content) {
            deltaText += delta.content;
            this.eventHandler({ type: 'text_delta', content: delta.content });
          } else if (delta.type === 'tool_use' && delta.toolCall) {
            this.handleToolCall(delta.toolCall);
          } else if (delta.type === 'message_end' && delta.usage) {
            this.eventHandler({ type: 'message_end', usage: delta.usage });
            this.saveMessage('assistant', deltaText, delta.usage);
          } else if (delta.type === 'error') {
            this.eventHandler({ type: 'error', message: delta.error || 'Unknown error' });
          }
        }
      );

      if (!deltaText && this.stepCount >= this.maxSteps) {
        this.eventHandler({ type: 'error', message: 'Max steps reached' });
        break;
      }

      const hasToolCalls = this.messages.some(m => 
        m.role === 'assistant' && 'toolCallId' in m
      );

      if (!hasToolCalls) {
        break;
      }
    }

    this.eventHandler({ type: 'step_count', count: this.stepCount });
  }

  private async handleToolCall(toolCall: ToolCall): Promise<void> {
    const { serverId, toolName } = extractServerIdFromToolName(toolCall.name);
    console.log('[Agent] Tool call:', toolName, 'from server:', serverId);

    if (!serverId) {
      console.log('[Agent] DENIED: No server ID in tool name');
      this.eventHandler({
        type: 'tool_call_result',
        outcome: 'denied',
        reason: 'Tool name must include server ID (server:tool)',
      });
      return;
    }

    this.stepCount++;
    this.eventHandler({ type: 'step_count', count: this.stepCount });

    console.log('[Agent] Tool call start:', toolName, 'input:', JSON.stringify(toolCall.input).substring(0, 100));
    this.eventHandler({
      type: 'tool_call_start',
      tool: toolName,
      server: serverId,
      input: toolCall.input,
    });

    const permResult = evaluatePermission({
      serverId,
      toolName,
      toolInput: toolCall.input,
    });

    if (!permResult.allowed) {
      console.log('[Agent] DENIED by permission guard:', permResult.reason);
      this.eventHandler({
        type: 'tool_call_result',
        outcome: 'denied',
        reason: permResult.reason,
      });

      await this.logActivity(serverId, toolName, toolCall.input, 'denied', permResult.reason);

      this.messages.push({
        role: 'tool',
        content: `Tool call denied: ${permResult.reason}`,
        toolCallId: toolCall.id,
        toolName,
      });

      return;
    }

    try {
      console.log('[Agent] Executing tool:', toolName);
      const server = getMCPServer(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      const startTime = Date.now();
      const result = await server.client.callTool(toolName, toolCall.input);
      const latency = Date.now() - startTime;

      this.eventHandler({
        type: 'tool_call_result',
        outcome: 'allowed',
        result,
      });

      await this.logActivity(serverId, toolName, toolCall.input, 'allowed', undefined, latency);

      const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      this.messages.push({
        role: 'tool',
        content: resultStr,
        toolCallId: toolCall.id,
        toolName,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      this.eventHandler({
        type: 'tool_call_result',
        outcome: 'denied',
        reason: errorMsg,
      });

      await this.logActivity(serverId, toolName, toolCall.input, 'denied', errorMsg);

      this.messages.push({
        role: 'tool',
        content: `Tool call failed: ${errorMsg}`,
        toolCallId: toolCall.id,
        toolName,
      });
    }
  }

  private async saveMessage(
    role: 'user' | 'assistant',
    content: string,
    usage?: { inputTokens: number; outputTokens: number }
  ): Promise<void> {
    console.log('[Agent] Saving message:', role, 'content length:', content.length);
    const db = getDb();
    const messageId = nanoid();

    db.insert(schema.messages as any).values({
      id: messageId,
      sessionId: this.config.sessionId,
      role,
      content,
      model: role === 'assistant' ? this.config.model : undefined,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      createdAt: Date.now(),
    });
    console.log('[Agent] Message saved:', messageId);
  }

  private async logActivity(
    serverId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    outcome: 'allowed' | 'denied',
    reason?: string,
    latency?: number
  ): Promise<void> {
    const db = getDb();
    
    db.insert(schema.activityLog as any).values({
      id: nanoid(),
      sessionId: this.config.sessionId,
      serverId,
      toolName,
      toolInput: JSON.stringify(toolInput),
      outcome,
      reason,
      latency,
      timestamp: new Date(),
    });
  }
}

export function createAgentRuntime(config: AgentConfig, eventHandler: EventHandler): AgentRuntime {
  return new AgentRuntime(config, eventHandler);
}
