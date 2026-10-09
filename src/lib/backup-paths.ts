import { resolve, join, normalize } from 'path';
import { mkdirSync, existsSync } from 'fs';

const BASE = 'C:\\Users\\Cmarffisis\\CODE\\backups\\StudioDreamNails';

export function getBasePath() {
  return BASE;
}

export function generateTimestamp() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
}

export function getBackupFolder(ts: string) {
  return resolve(join(BASE, ts));
}

export function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export function isPathSafe(target: string) {
  const base = resolve(BASE);
  const t = resolve(target);
  const rel = normalize(t).replace(/^[A-Z]:/, '').replace(base.replace(/^[A-Z]:/, ''), '').replace(/^[/\\\\]/, '');
  if (rel.includes('..')) return false;
  return t.startsWith(base) || base.startsWith(t);
}
