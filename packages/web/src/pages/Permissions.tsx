import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, FolderOpen, Terminal, Globe, Network, X } from 'lucide-react';
import { useState } from 'react';

interface Permission {
  id: string;
  serverId: string;
  allowedPaths: string[];
  deniedPaths: string[];
  pathRead: boolean;
  pathWrite: boolean;
  pathCreate: boolean;
  pathDelete: boolean;
  pathListDir: boolean;
  bashAllowed: boolean;
  bashAllowedCommands: string[];
  webfetchAllowed: boolean;
  webfetchAllowedDomains: string[];
  subprocessAllowed: boolean;
  networkAllowed: boolean;
  maxCallsPerMinute: number;
  maxTokensPerCall: number;
}

export default function Permissions() {
  const { serverId } = useParams<{ serverId: string }>();
  const queryClient = useQueryClient();
  const [newPath, setNewPath] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const { data: permission, isLoading } = useQuery<Permission>({
    queryKey: ['permission', serverId],
    queryFn: async () => {
      const res = await fetch(`/api/permissions/${serverId}`);
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return res.json();
    },
    enabled: !!serverId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Permission>) => {
      const res = await fetch(`/api/permissions/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update permissions');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission', serverId] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
  });

  const addAllowedPath = () => {
    if (!newPath.trim() || !permission) return;
    updateMutation.mutate({
      allowedPaths: [...permission.allowedPaths, newPath.trim()],
    });
    setNewPath('');
  };

  const removeAllowedPath = (path: string) => {
    if (!permission) return;
    updateMutation.mutate({
      allowedPaths: permission.allowedPaths.filter(p => p !== path),
    });
  };

  const addCommand = () => {
    if (!newCommand.trim() || !permission) return;
    updateMutation.mutate({
      bashAllowedCommands: [...permission.bashAllowedCommands, newCommand.trim()],
    });
    setNewCommand('');
  };

  const removeCommand = (cmd: string) => {
    if (!permission) return;
    updateMutation.mutate({
      bashAllowedCommands: permission.bashAllowedCommands.filter(c => c !== cmd),
    });
  };

  const addDomain = () => {
    if (!newDomain.trim() || !permission) return;
    updateMutation.mutate({
      webfetchAllowedDomains: [...permission.webfetchAllowedDomains, newDomain.trim()],
    });
    setNewDomain('');
  };

  const removeDomain = (domain: string) => {
    if (!permission) return;
    updateMutation.mutate({
      webfetchAllowedDomains: permission.webfetchAllowedDomains.filter(d => d !== domain),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!permission) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Permission not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/servers" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
        {saveStatus === 'saving' && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
        {saveStatus === 'saved' && <span className="text-green-600 text-sm">Saved!</span>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Filesystem</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Allowed Paths</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/workspace"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && addAllowedPath()}
                />
                <button
                  onClick={addAllowedPath}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-1">
                {permission.allowedPaths.map(path => (
                  <div key={path} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
                    <span className="text-sm font-mono">{path}</span>
                    <button onClick={() => removeAllowedPath(path)} className="text-gray-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {permission.allowedPaths.length === 0 && (
                  <p className="text-sm text-gray-500">No allowed paths configured</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permission.pathRead}
                  onChange={(e) => updateMutation.mutate({ pathRead: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Read</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permission.pathWrite}
                  onChange={(e) => updateMutation.mutate({ pathWrite: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Write</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permission.pathCreate}
                  onChange={(e) => updateMutation.mutate({ pathCreate: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Create</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permission.pathDelete}
                  onChange={(e) => updateMutation.mutate({ pathDelete: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">Delete</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permission.pathListDir}
                  onChange={(e) => updateMutation.mutate({ pathListDir: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm">List Directory</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Bash</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permission.bashAllowed}
                onChange={(e) => updateMutation.mutate({ bashAllowed: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Allow bash execution</span>
            </label>

            {permission.bashAllowed && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Allowed Commands (glob patterns)</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="git *"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && addCommand()}
                  />
                  <button
                    onClick={addCommand}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1">
                  {permission.bashAllowedCommands.map(cmd => (
                    <div key={cmd} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
                      <span className="text-sm font-mono">{cmd}</span>
                      <button onClick={() => removeCommand(cmd)} className="text-gray-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Web Fetch</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permission.webfetchAllowed}
                onChange={(e) => updateMutation.mutate({ webfetchAllowed: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Allow web fetch</span>
            </label>

            {permission.webfetchAllowed && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Allowed Domains</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <button
                    onClick={addDomain}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1">
                  {permission.webfetchAllowedDomains.map(domain => (
                    <div key={domain} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
                      <span className="text-sm font-mono">{domain}</span>
                      <button onClick={() => removeDomain(domain)} className="text-gray-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Other</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permission.subprocessAllowed}
                onChange={(e) => updateMutation.mutate({ subprocessAllowed: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Allow subprocess spawning</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permission.networkAllowed}
                onChange={(e) => updateMutation.mutate({ networkAllowed: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm">Allow network access</span>
            </label>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Rate Limits</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Max calls per minute</label>
                  <input
                    type="number"
                    value={permission.maxCallsPerMinute}
                    onChange={(e) => updateMutation.mutate({ maxCallsPerMinute: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
