import { resolve, normalize, join } from 'path';
import { mkdirSync } from 'fs';

const BASE = 'C:\\Users\\Cmarffisis\\CODE\\backups\\StudioDreamNails';

export function getBasePath() { return BASE; }

export function generateTimestamp() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return ${d.getFullYear()}--_--;
}

export function getBackupFolder(ts: string) {
  const p = resolve(join(BASE, ts));
  return p;
}

export function ensureDir(p: string) {
  try { mkdirSync(p, { recursive: true }); } catch {} }

export function isPathSafe(target: string) {
  const base = resolve(BASE);
  const t = resolve(target);
  return t.startsWith(base + (process.platform==='win32' ? '\\\\' : '/')) || t.startsWith(base);
}
