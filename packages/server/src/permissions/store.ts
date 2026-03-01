import { getDb, schema } from '../db/index.js';
import { nanoid } from 'nanoid';

export interface ServerPermission {
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
  createdAt: Date;
  updatedAt: Date;
}

export function getPermissionForServer(serverId: string): ServerPermission | null {
  const db = getDb();
  const perms = db.select(schema.permissions as any).where((getCol: (col: string) => any) => getCol('server_id') === serverId).all() as any[];
  
  if (perms.length === 0) return null;
  
  const perm = perms[0];
  
  return {
    id: perm.id,
    serverId: perm.server_id,
    allowedPaths: JSON.parse(perm.allowed_paths || '[]'),
    deniedPaths: JSON.parse(perm.denied_paths || '[]'),
    pathRead: Boolean(perm.path_read),
    pathWrite: Boolean(perm.path_write),
    pathCreate: Boolean(perm.path_create),
    pathDelete: Boolean(perm.path_delete),
    pathListDir: Boolean(perm.path_list_dir),
    bashAllowed: Boolean(perm.bash_allowed),
    bashAllowedCommands: JSON.parse(perm.bash_allowed_commands || '[]'),
    webfetchAllowed: Boolean(perm.webfetch_allowed),
    webfetchAllowedDomains: JSON.parse(perm.webfetch_allowed_domains || '[]'),
    subprocessAllowed: Boolean(perm.subprocess_allowed),
    networkAllowed: Boolean(perm.network_allowed),
    maxCallsPerMinute: perm.max_calls_per_minute,
    maxTokensPerCall: perm.max_tokens_per_call,
    createdAt: new Date(perm.created_at),
    updatedAt: new Date(perm.updated_at),
  };
}

export async function createDefaultPermission(serverId: string): Promise<ServerPermission> {
  const db = getDb();
  const now = Date.now();
  const id = nanoid();
  
  const perm = {
    id,
    serverId,
    allowed_paths: JSON.stringify([]),
    denied_paths: JSON.stringify([]),
    path_read: 0,
    path_write: 0,
    path_create: 0,
    path_delete: 0,
    path_list_dir: 0,
    bash_allowed: 0,
    bash_allowed_commands: JSON.stringify([]),
    webfetch_allowed: 0,
    webfetch_allowed_domains: JSON.stringify([]),
    subprocess_allowed: 0,
    network_allowed: 0,
    max_calls_per_minute: 30,
    max_tokens_per_call: 100000,
    created_at: now,
    updated_at: now,
  };

  db.insert(schema.permissions as any).values(perm);
  
  return {
    ...perm,
    allowedPaths: [],
    deniedPaths: [],
    bashAllowedCommands: [],
    webfetchAllowedDomains: [],
    pathRead: false,
    pathWrite: false,
    pathCreate: false,
    pathDelete: false,
    pathListDir: false,
    bashAllowed: false,
    webfetchAllowed: false,
    subprocessAllowed: false,
    networkAllowed: false,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  } as ServerPermission;
}

export async function updatePermission(serverId: string, updates: Partial<ServerPermission>): Promise<ServerPermission> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = { updated_at: Date.now() };
  
  if (updates.allowedPaths !== undefined) dbUpdates.allowed_paths = JSON.stringify(updates.allowedPaths);
  if (updates.deniedPaths !== undefined) dbUpdates.denied_paths = JSON.stringify(updates.deniedPaths);
  if (updates.pathRead !== undefined) dbUpdates.path_read = updates.pathRead ? 1 : 0;
  if (updates.pathWrite !== undefined) dbUpdates.path_write = updates.pathWrite ? 1 : 0;
  if (updates.pathCreate !== undefined) dbUpdates.path_create = updates.pathCreate ? 1 : 0;
  if (updates.pathDelete !== undefined) dbUpdates.path_delete = updates.pathDelete ? 1 : 0;
  if (updates.pathListDir !== undefined) dbUpdates.path_list_dir = updates.pathListDir ? 1 : 0;
  if (updates.bashAllowed !== undefined) dbUpdates.bash_allowed = updates.bashAllowed ? 1 : 0;
  if (updates.bashAllowedCommands !== undefined) dbUpdates.bash_allowed_commands = JSON.stringify(updates.bashAllowedCommands);
  if (updates.webfetchAllowed !== undefined) dbUpdates.webfetch_allowed = updates.webfetchAllowed ? 1 : 0;
  if (updates.webfetchAllowedDomains !== undefined) dbUpdates.webfetch_allowed_domains = JSON.stringify(updates.webfetchAllowedDomains);
  if (updates.subprocessAllowed !== undefined) dbUpdates.subprocess_allowed = updates.subprocessAllowed ? 1 : 0;
  if (updates.networkAllowed !== undefined) dbUpdates.network_allowed = updates.networkAllowed ? 1 : 0;
  if (updates.maxCallsPerMinute !== undefined) dbUpdates.max_calls_per_minute = updates.maxCallsPerMinute;
  if (updates.maxTokensPerCall !== undefined) dbUpdates.max_tokens_per_call = updates.maxTokensPerCall;

  db.update(schema.permissions as any).set(dbUpdates).where(() => () => true);
  
  const perm = getPermissionForServer(serverId);
  if (!perm) throw new Error('Permission not found after update');
  return perm;
}

export async function deletePermission(serverId: string): Promise<void> {
  const db = getDb();
  db.delete(schema.permissions as any).where(() => () => true);
}

export function getAllPermissions(): ServerPermission[] {
  const db = getDb();
  const perms = db.select(schema.permissions as any).where().all() as any[];
  
  return perms.map(perm => ({
    id: perm.id,
    serverId: perm.server_id,
    allowedPaths: JSON.parse(perm.allowed_paths || '[]'),
    deniedPaths: JSON.parse(perm.denied_paths || '[]'),
    pathRead: Boolean(perm.path_read),
    pathWrite: Boolean(perm.path_write),
    pathCreate: Boolean(perm.path_create),
    pathDelete: Boolean(perm.path_delete),
    pathListDir: Boolean(perm.path_list_dir),
    bashAllowed: Boolean(perm.bash_allowed),
    bashAllowedCommands: JSON.parse(perm.bash_allowed_commands || '[]'),
    webfetchAllowed: Boolean(perm.webfetch_allowed),
    webfetchAllowedDomains: JSON.parse(perm.webfetch_allowed_domains || '[]'),
    subprocessAllowed: Boolean(perm.subprocess_allowed),
    networkAllowed: Boolean(perm.network_allowed),
    maxCallsPerMinute: perm.max_calls_per_minute,
    maxTokensPerCall: perm.max_tokens_per_call,
    createdAt: new Date(perm.created_at),
    updatedAt: new Date(perm.updated_at),
  }));
}
