import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import type { ToolDefinition } from '../llm/provider.js';

export interface MCPClientOptions {
  command: string;
  args?: string[];
  envVars?: Record<string, string>;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: ChildProcess | null = null;
  private tools: ToolDefinition[] = [];
  private connected = false;

  async connect(options: MCPClientOptions): Promise<void> {
    const env = { ...process.env, ...options.envVars };

    this.process = spawn(options.command, options.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.transport = new StdioClientTransport({
      stdin: this.process.stdin!,
      stdout: this.process.stdout!,
      stderr: this.process.stderr,
    });

    this.client = new Client(
      {
        name: 'openmacaw-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
    this.connected = true;

    await this.loadTools();
  }

  private async loadTools(): Promise<void> {
    if (!this.client) return;

    const response = await this.client.request(
      { method: 'tools/list' },
      { method: 'tools/list', params: {} }
    );

    this.tools = (response.tools || []).map((tool: { name: string; description?: string; inputSchema: unknown }) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.request(
      { method: 'tools/call' },
      {
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      }
    );

    return response;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.transport = null;
    this.connected = false;
  }
}
