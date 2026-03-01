import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: string;
  toolResults?: string;
}

interface Session {
  id: string;
  title: string;
  model: string;
  mode: 'build' | 'plan';
  messages: Message[];
}

interface ChatEvent {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_result' | 'message_end' | 'error' | 'step_count';
  content?: string;
  tool?: string;
  server?: string;
  input?: Record<string, unknown>;
  outcome?: 'allowed' | 'denied';
  result?: unknown;
  reason?: string;
  usage?: { inputTokens: number; outputTokens: number };
  message?: string;
  count?: number;
}

export default function Chat() {
  const { id: sessionId } = useParams<{ id: string }>();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions');
      return res.json();
    },
  });

  const { data: currentSession, isLoading: sessionLoading } = useQuery<Session>({
    queryKey: ['session', currentSessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${currentSessionId}`);
      return res.json();
    },
    enabled: !!currentSessionId,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation', model: 'claude-3-5-sonnet-20241022' }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setCurrentSessionId(data.id);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (currentSessionId === deleteSessionMutation.variables) {
        setCurrentSessionId(sessions?.[0]?.id || null);
      }
    },
  });

  useEffect(() => {
    if (sessions?.length && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  // Listen for new-chat events dispatched from the App sidebar
  useEffect(() => {
    const handler = () => createSessionMutation.mutate();
    window.addEventListener('openmacaw:new-chat', handler);
    return () => window.removeEventListener('openmacaw:new-chat', handler);
  }, [createSessionMutation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, streamingContent]);

  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/chat`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data: ChatEvent = JSON.parse(event.data);

      switch (data.type) {
        case 'text_delta':
          setStreamingContent(prev => prev + (data.content || ''));
          break;
        case 'tool_call_start':
          setStreamingContent(prev => prev + `\n[Calling tool: ${data.tool}]`);
          break;
        case 'tool_call_result':
          if (data.outcome === 'denied') {
            setStreamingContent(prev => prev + `\n[Denied: ${data.reason}]`);
          } else {
            setStreamingContent(prev => prev + `\n[Tool result: ${JSON.stringify(data.result)}]`);
          }
          break;
        case 'message_end':
          setIsStreaming(false);
          setStreamingContent('');
          queryClient.invalidateQueries({ queryKey: ['session', currentSessionId] });
          break;
        case 'error':
          setIsStreaming(false);
          setStreamingContent(prev => prev + `\n[Error: ${data.message}]`);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsStreaming(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsStreaming(false);
    };

    wsRef.current = ws;
    return ws;
  }, [currentSessionId, queryClient]);

  const sendMessage = () => {
    if (!input.trim() || !currentSessionId || isStreaming) return;

    setIsStreaming(true);
    setStreamingContent('');

    const ws = connectWebSocket();

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'chat',
        sessionId: currentSessionId,
        message: input,
      }));
      setInput('');
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const allMessages = [...(currentSession?.messages || [])];
  if (isStreaming) {
    allMessages.push({
      id: 'streaming',
      role: 'assistant',
      content: streamingContent,
    });
  }

  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="h-14 px-3 border-b border-gray-200 flex items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversations</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessionsLoading ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : (
            sessions?.map(session => (
              <div
                key={session.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg mb-1 cursor-pointer ${
                  currentSessionId === session.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
                }`}
                onClick={() => setCurrentSessionId(session.id)}
              >
                <span className="truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this conversation?')) {
                      deleteSessionMutation.mutate(session.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!currentSessionId ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select or create a conversation to start
            </div>
          ) : sessionLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Send a message to start the conversation
            </div>
          ) : (
            allMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.role === 'tool'
                      ? 'bg-yellow-50 text-gray-800 border border-yellow-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-800 prose-pre:text-gray-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
