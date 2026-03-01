import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getMCPServer } from '../mcp/registry.js';
import { getDb, schema } from '../db/index.js';
import { nanoid } from 'nanoid';
import { extractServerIdFromToolName } from '../permissions/index.js';

const executeSchema = z.object({
  toolCalls: z.array(
    z.object({
      name: z.string(),
      arguments: z.record(z.unknown()),
    })
  ),
  user_approved: z.boolean(),
  sessionId: z.string().optional(),
});

export async function executeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = executeSchema.parse(request.body);

      if (!payload.user_approved) {
        return reply.code(403).send({ error: 'Forbidden: user_approved must be true' });
      }

      if (payload.toolCalls.length === 0) {
        return reply.code(400).send({ error: 'No tool calls provided' });
      }

      const results = [];
      const db = getDb();

      for (const call of payload.toolCalls) {
        const { serverId, toolName } = extractServerIdFromToolName(call.name);

        if (!serverId) {
          const errorMsg = 'Tool name must include server ID (server:tool)';
          
          db.insert(schema.activityLog as any).values({
            id: nanoid(),
            sessionId: payload.sessionId || 'anonymous',
            serverId: 'unknown',
            toolName: call.name,
            toolInput: JSON.stringify(call.arguments),
            outcome: 'denied',
            reason: errorMsg,
            timestamp: new Date(),
          });

          results.push({ name: call.name, status: 'failed', error: errorMsg });
          continue;
        }

        const server = getMCPServer(serverId);
        if (!server || !server.client.isConnected()) {
          const errorMsg = `Server ${serverId} not found or not connected`;

          db.insert(schema.activityLog as any).values({
            id: nanoid(),
            sessionId: payload.sessionId || 'anonymous',
            serverId,
            toolName,
            toolInput: JSON.stringify(call.arguments),
            outcome: 'denied',
            reason: errorMsg,
            timestamp: new Date(),
          });

          results.push({ name: call.name, status: 'failed', error: errorMsg });
          continue;
        }

        try {
          const startTime = Date.now();
          const result = await server.client.callTool(toolName, call.arguments);
          const latency = Date.now() - startTime;

          db.insert(schema.activityLog as any).values({
            id: nanoid(),
            sessionId: payload.sessionId || 'anonymous',
            serverId,
            toolName,
            toolInput: JSON.stringify(call.arguments),
            outcome: 'allowed',
            latency,
            timestamp: new Date(),
          });

          results.push({ name: call.name, status: 'success', result });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error during execution';

          db.insert(schema.activityLog as any).values({
            id: nanoid(),
            sessionId: payload.sessionId || 'anonymous',
            serverId,
            toolName,
            toolInput: JSON.stringify(call.arguments),
            outcome: 'denied',
            reason: errorMsg,
            timestamp: new Date(),
          });

          results.push({ name: call.name, status: 'failed', error: errorMsg });
        }
      }

      return reply.send({ results });
    } catch (error) {
      console.error('[Execute API] Validation or processing error:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid payload', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
