import { useQuery } from '@tanstack/react-query';
import { Loader2, Filter, XCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

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
      
      const res = await fetch(`/api/activity?${params}`);
      return res.json();
    },
  });

  const { data: servers } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await fetch('/api/servers');
      return res.json();
    },
  });

  const serverMap = new Map(servers?.map(s => [s.id, s.name]) || []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter.serverId || ''}
            onChange={(e) => setFilter({ ...filter, serverId: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Servers</option>
            {servers?.map(server => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </select>
          <select
            value={filter.outcome || ''}
            onChange={(e) => setFilter({ ...filter, outcome: e.target.value || undefined })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Server</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tool</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Outcome</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activities?.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(activity.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {serverMap.get(activity.serverId) || activity.serverId}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{activity.toolName}</td>
                  <td className="px-4 py-3">
                    {activity.outcome === 'allowed' ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Allowed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        {activity.reason || 'Denied'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
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
