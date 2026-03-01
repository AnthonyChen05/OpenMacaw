import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAgentRuntime, getSession, type AgentEvent } from '../agent/index.js';
import { getConfig } from '../config.js';

const chatSchema = z.object({
  type: z.literal('chat'),
  sessionId: z.string(),
  message: z.string(),
  model: z.string().optional(),
  mode: z.enum(['build', 'plan']).optional(),
});

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/ws/chat', { websocket: true }, (socket, request) => {
    console.log('[WebSocket] New connection');
    socket.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
    });

    const sendEvent = (event: AgentEvent) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(event));
      }
    };

    socket.on('message', async (data) => {
      console.log('[WebSocket] Received message');
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'chat') {
          const { sessionId, message: userMessage, model, mode } = chatSchema.parse(message);
          console.log('[WebSocket] Chat message:', userMessage.substring(0, 50), 'session:', sessionId);

          const session = getSession(sessionId);
          if (!session) {
            console.log('[WebSocket] Session not found:', sessionId);
            sendEvent({ type: 'error', message: 'Session not found' });
            return;
          }

          const config = getConfig();
          console.log('[WebSocket] Creating agent with model:', model || session.model || config.DEFAULT_MODEL);

          await createAgentRuntime(
            {
              sessionId,
              model: model || session.model || config.DEFAULT_MODEL,
              systemPrompt: session.systemPrompt || config.SYSTEM_PROMPT,
              mode: mode || session.mode,
              maxSteps: config.MAX_STEPS,
            },
            sendEvent
          ).run(userMessage);

        } else {
          console.log('[WebSocket] Unknown message type');
          sendEvent({ type: 'error', message: 'Unknown message type' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[WebSocket] Parse error:', errorMessage);
        sendEvent({ type: 'error', message: errorMessage });
      }
    });

    socket.on('close', () => {
      console.log('[WebSocket] Connection closed');
    });
  });

  // HTTP test endpoint for quick testing without WebSocket
  fastify.post('/api/chat-test', async (request, reply) => {
    const body = request.body as { sessionId?: string; message?: string; model?: string };
    const { sessionId, message, model } = body;

    console.log('[HTTP Test] Chat request:', message?.substring(0, 50), 'session:', sessionId);

    if (!sessionId || !message) {
      return reply.code(400).send({ error: 'sessionId and message required' });
    }

    const session = getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const config = getConfig();
    const events: AgentEvent[] = [];

    const eventHandler = (event: AgentEvent) => {
      console.log('[HTTP Test] Event:', event.type);
      events.push(event);
    };

    try {
      await createAgentRuntime(
        {
          sessionId,
          model: model || session.model || config.DEFAULT_MODEL,
          systemPrompt: session.systemPrompt || config.SYSTEM_PROMPT,
          mode: session.mode,
          maxSteps: config.MAX_STEPS,
        },
        eventHandler
      ).run(message);

      return reply.send({ events });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[HTTP Test] Error:', errorMessage);
      return reply.code(500).send({ error: errorMessage, events });
    }
  });
}
