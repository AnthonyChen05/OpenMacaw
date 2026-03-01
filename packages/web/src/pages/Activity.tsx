import { useQuery } from '@tanstack/react-query';
import { Loader2, Filter, XCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '../api';

interface ActivityEntry {
  id: string;
  serverId: string;
  toolName: string;
  toolInput: string;
  outcome: 'allowed' | 'denied';
  reason?: string;
  latency?: number;
  timestamp: string;
}

export default function Activity() {
  const [filter, setFilter] = useState<{ serverId?: string; outcome?: string }>({});

  const { data: activities, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ['activity', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.serverId) params.set('serverId', filter.serverId);
      if (filter.outcome) params.set('type', filter.outcome);
      params.set('limit', '50');
      
      const res = await apiFetch(`/api/activity?${params}`);
      return res.json();
    },
  });

  const { data: servers } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await apiFetch('/api/servers');
      return res.json();
    },
  });

  const serverMap = new Map(servers?.map(s => [s.id, s.name]) || []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Guardian Audit Logs</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter.serverId || ''}
            onChange={(e) => setFilter({ ...filter, serverId: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-zinc-100 dark:bg-zinc-900 text-gray-900 dark:text-white"
          >
            <option value="">All Servers</option>
            {servers?.map(server => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </select>
          <select
            value={filter.outcome || ''}
            onChange={(e) => setFilter({ ...filter, outcome: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-zinc-100 dark:bg-zinc-900 text-gray-900 dark:text-white"
          >
            <option value="">All Outcomes</option>
            <option value="allowed">Allowed</option>
            <option value="denied">Denied</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Server</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Tool</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Outcome</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {activities?.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {new Date(activity.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 font-medium">
                    {serverMap.get(activity.serverId) || activity.serverId}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-cyan-600 dark:text-cyan-400">{activity.toolName}</td>
                  <td className="px-4 py-3">
                    {activity.outcome === 'allowed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        {activity.reason ? `Blocked: ${activity.reason}` : 'Blocked'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {activity.latency ? `${activity.latency}ms` : '-'}
                  </td>
                </tr>
              ))}
              {activities?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No activity recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
