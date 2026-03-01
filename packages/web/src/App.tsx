import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Server, Activity, Settings, Shield,
  ChevronLeft, ChevronRight, Bot, Plus, X, Save, Loader2, Menu,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentForm {
  AGENT_NAME: string;
  AGENT_DESCRIPTION: string;
  SYSTEM_PROMPT: string;
  DEFAULT_MODEL: string;
  MAX_STEPS: string;
  TEMPERATURE: string;
}

interface McpServer {
  id: string;
  name: string;
  transport: string;
  enabled: boolean;
  toolCount: number;
  status: string;
}

// ─── AgentPanel ───────────────────────────────────────────────────────────────

function AgentPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<AgentForm>({
    AGENT_NAME: '',
    AGENT_DESCRIPTION: '',
    SYSTEM_PROMPT: '',
    DEFAULT_MODEL: '',
    MAX_STEPS: '50',
    TEMPERATURE: '1.0',
  });

  useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setForm({
        AGENT_NAME: data.AGENT_NAME || '',
        AGENT_DESCRIPTION: data.AGENT_DESCRIPTION || '',
        SYSTEM_PROMPT: data.SYSTEM_PROMPT || '',
        DEFAULT_MODEL: data.DEFAULT_MODEL || '',
        MAX_STEPS: data.MAX_STEPS || '50',
        TEMPERATURE: data.TEMPERATURE || '1.0',
      });
      return data;
    },
    enabled: isOpen,
    staleTime: 0,
  });

  const { data: servers, isLoading: serversLoading } = useQuery<McpServer[]>({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await fetch('/api/servers');
      return res.json();
    },
    enabled: isOpen,
  });

  const toggleServer = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] }),
  });

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(form)) {
      await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    }
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Configure Agent</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {/* Identity */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Identity</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                <input
                  type="text"
                  value={form.AGENT_NAME}
                  onChange={(e) => setForm({ ...form, AGENT_NAME: e.target.value })}
                  placeholder="My Assistant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.AGENT_DESCRIPTION}
                  onChange={(e) => setForm({ ...form, AGENT_DESCRIPTION: e.target.value })}
                  placeholder="A helpful coding assistant..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Personality */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Personality</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                <textarea
                  value={form.SYSTEM_PROMPT}
                  onChange={(e) => setForm({ ...form, SYSTEM_PROMPT: e.target.value })}
                  placeholder="You are a helpful AI assistant..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={form.DEFAULT_MODEL}
                    onChange={(e) => setForm({ ...form, DEFAULT_MODEL: e.target.value })}
                    placeholder="claude-haiku-4-5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.TEMPERATURE}
                    onChange={(e) => setForm({ ...form, TEMPERATURE: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Steps</label>
                <input
                  type="number"
                  value={form.MAX_STEPS}
                  onChange={(e) => setForm({ ...form, MAX_STEPS: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* MCP Servers & Skills */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">MCP Servers &amp; Skills</p>
            {serversLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : !servers || servers.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-gray-500 mb-2">No MCP servers configured.</p>
                <Link to="/servers" onClick={onClose} className="text-sm text-purple-600 hover:underline font-medium">
                  Add a server →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map((server) => (
                  <div key={server.id} className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{server.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                        {server.toolCount} tools &middot; {server.transport}
                        {server.status === 'running' && (
                          <>
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                            <span>running</span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleServer.mutate({ id: server.id, enabled: !server.enabled })}
                      className={`ml-4 relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        server.enabled ? 'bg-purple-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        server.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);   // desktop collapse
  const [isMobileOpen, setIsMobileOpen] = useState(false); // mobile overlay
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/chat', label: 'Chat', icon: MessageSquare },
    { path: '/servers', label: 'Servers', icon: Server },
    { path: '/activity', label: 'Activity', icon: Activity },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleNewChat = () => {
    window.dispatchEvent(new CustomEvent('openmacaw:new-chat'));
    setIsMobileOpen(false);
  };

  const openAgentPanel = () => {
    setIsMobileOpen(false);
    setIsAgentPanelOpen(true);
  };

  return (
    <>
      <AgentPanel isOpen={isAgentPanelOpen} onClose={() => setIsAgentPanelOpen(false)} />

      <div className="flex h-screen bg-gray-50">

        {/* ── Mobile top bar ── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900">OpenMacaw</span>
          </div>
          {/* New chat shortcut on mobile when on /chat */}
          {location.pathname.startsWith('/chat') && (
            <button
              onClick={handleNewChat}
              className="ml-auto p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* ── Mobile backdrop ── */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={[
            // Base layout & styling
            'bg-white border-r border-gray-200 flex flex-col overflow-hidden shrink-0',
            // Mobile: fixed overlay, slides in/out
            'fixed inset-y-0 left-0 z-50',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full',
            'w-72',
            // Desktop: relative, collapsible width, always visible
            'md:relative md:translate-x-0',
            isCollapsed ? 'md:w-14' : 'md:w-56',
            // Transitions
            'transition-transform md:transition-all duration-200 ease-in-out',
          ].join(' ')}
        >
          {/* Logo — desktop only (mobile has top bar) */}
          <div className={`hidden md:flex items-center h-14 px-3 border-b border-gray-200 ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <Shield className="w-5 h-5 text-blue-600 shrink-0" />
            {!isCollapsed && <span className="text-base font-bold text-gray-900 truncate">OpenMacaw</span>}
          </div>

          {/* Mobile sidebar header */}
          <div className="md:hidden flex items-center justify-between h-14 px-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-gray-900">OpenMacaw</span>
            </div>
            <button onClick={() => setIsMobileOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-hidden">
            {/* Configure Agent */}
            <button
              onClick={openAgentPanel}
              title="Configure Agent"
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors ${
                isCollapsed ? 'md:justify-center' : ''
              }`}
            >
              <Bot className="w-5 h-5 shrink-0" />
              <span className={`text-sm font-medium truncate ${isCollapsed ? 'md:hidden' : ''}`}>Configure Agent</span>
            </button>

            {/* New Chat — only on /chat */}
            {location.pathname.startsWith('/chat') && (
              <button
                onClick={handleNewChat}
                title="New Chat"
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors ${
                  isCollapsed ? 'md:justify-center' : ''
                }`}
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span className={`text-sm font-medium ${isCollapsed ? 'md:hidden' : ''}`}>New Chat</span>
              </button>
            )}

            <div className="my-1 h-px bg-gray-100" />

            {/* Page nav */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors ${
                    isCollapsed ? 'md:justify-center' : ''
                  } ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className={`text-sm font-medium ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Collapse toggle — desktop only */}
          <div className="hidden md:block p-2 border-t border-gray-100">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {!isCollapsed && <span className="text-xs text-gray-400">Collapse</span>}
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto min-w-0 pt-14 md:pt-0">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default App;
