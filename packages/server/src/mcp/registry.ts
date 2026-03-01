import { MCPClient } from './client.js';
import type { ToolDefinition } from '../llm/provider.js';
import { getDb, schema } from '../db/index.js';

export type ServerStatus = 'stopped' | 'running' | 'error' | 'unhealthy';

export interface MCPServerInfo {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  envVars?: Record<string, string>;
  url?: string;
  status: ServerStatus;
  toolCount: number;
  lastError?: string;
}

const servers: Map<string, { client: MCPClient; info: MCPServerInfo }> = new Map();

export function getMCPServer(id: string): { client: MCPClient; info: MCPServerInfo } | undefined {
  return servers.get(id);
}

export async function registerServer(serverData: {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  envVars?: Record<string, string>;
  url?: string;
}): Promise<MCPServerInfo> {
  const existing = servers.get(serverData.id);
  if (existing) {
    await existing.client.disconnect();
    servers.delete(serverData.id);
  }

  const client = new MCPClient();
  const info: MCPServerInfo = {
    ...serverData,
    status: 'stopped',
    toolCount: 0,
  };

  servers.set(serverData.id, { client, info });
  return info;
}

export async function startServer(id: string): Promise<MCPServerInfo> {
  const server = servers.get(id);
  if (!server) {
    throw new Error(`Server ${id} not found`);
  }

  const db = getDb();
  const serversData = db.select(schema.servers as any).where((getCol: (col: string) => any) => getCol('id') === id).all() as any[];

  if (serversData.length === 0) {
    throw new Error(`Server ${id} not in database`);
  }

  const serverData = serversData[0];

  try {
    if (serverData.transport === 'stdio' && serverData.command) {
      const envVars = serverData.env_vars ? JSON.parse(serverData.env_vars) : undefined;
      await server.client.connect({
        command: serverData.command,
        args: serverData.args ? JSON.parse(serverData.args) : undefined,
        envVars,
      });
    } else {
      throw new Error('HTTP transport not yet implemented');
    }

    server.info.status = 'running';
    server.info.toolCount = server.client.getTools().length;

  } catch (error) {
    server.info.status = 'error';
    server.info.lastError = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }

  return server.info;
}

export async function stopServer(id: string): Promise<MCPServerInfo> {
  const server = servers.get(id);
  if (!server) {
    throw new Error(`Server ${id} not found`);
  }

  await server.client.disconnect();
  server.info.status = 'stopped';
  server.info.toolCount = 0;

  return server.info;
}

export function getAllServers(): MCPServerInfo[] {
  return Array.from(servers.values()).map(s => s.info);
}

export function getServerTools(id: string): ToolDefinition[] {
  const server = servers.get(id);
  if (!server || !server.client.isConnected()) {
    return [];
  }
  return server.client.getTools();
}

export function getAllTools(): ToolDefinition[] {
  const allTools: ToolDefinition[] = [];
  for (const [, server] of servers) {
    if (server.client.isConnected()) {
      for (const tool of server.client.getTools()) {
        allTools.push({
          ...tool,
          name: `${server.info.id}:${tool.name}`,
        });
      }
    }
  }
  return allTools;
}

export async function removeServer(id: string): Promise<void> {
  const server = servers.get(id);
  if (server) {
    await server.client.disconnect();
    servers.delete(id);
  }
}
