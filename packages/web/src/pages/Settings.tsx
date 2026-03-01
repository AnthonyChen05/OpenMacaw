import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';

interface Settings {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  DEFAULT_MODEL?: string;
  DEFAULT_PROVIDER?: string;
  MAX_STEPS?: string;
  TEMPERATURE?: string;
  SYSTEM_PROMPT?: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Settings>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setFormData(data);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Settings) => {
      for (const [key, value] of Object.entries(updates)) {
        await fetch(`/api/settings/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
  });

  const handleSave = () => {
    setSaveStatus('saving');
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saveStatus === 'saving' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>
        {saveStatus === 'saved' && <span className="text-green-600 text-sm">Saved!</span>}
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-4">LLM Providers</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={formData.ANTHROPIC_API_KEY || ''}
                onChange={(e) => setFormData({ ...formData, ANTHROPIC_API_KEY: e.target.value })}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
              <input
                type="password"
                value={formData.OPENAI_API_KEY || ''}
                onChange={(e) => setFormData({ ...formData, OPENAI_API_KEY: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ollama Base URL</label>
              <input
                type="text"
                value={formData.OLLAMA_BASE_URL || ''}
                onChange={(e) => setFormData({ ...formData, OLLAMA_BASE_URL: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-4">Agent Behavior</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Provider</label>
              <select
                value={formData.DEFAULT_PROVIDER || 'anthropic'}
                onChange={(e) => setFormData({ ...formData, DEFAULT_PROVIDER: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
              <input
                type="text"
                value={formData.DEFAULT_MODEL || ''}
                onChange={(e) => setFormData({ ...formData, DEFAULT_MODEL: e.target.value })}
                placeholder="claude-3-5-sonnet-20241022"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Steps</label>
              <input
                type="number"
                value={formData.MAX_STEPS || '50'}
                onChange={(e) => setFormData({ ...formData, MAX_STEPS: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={formData.TEMPERATURE || '1.0'}
                onChange={(e) => setFormData({ ...formData, TEMPERATURE: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-4">System Prompt</h2>
          <textarea
            value={formData.SYSTEM_PROMPT || ''}
            onChange={(e) => setFormData({ ...formData, SYSTEM_PROMPT: e.target.value })}
            placeholder="You are a helpful AI assistant..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
