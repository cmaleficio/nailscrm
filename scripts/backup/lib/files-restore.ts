import { cpSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

export function restoreUploads(backupPublic: string, backupPrivate: string, targetPublic: string, targetPrivate: string) {
  if (existsSync(backupPublic)) {
    if (existsSync(targetPublic)) rmSync(targetPublic, { recursive: true, force: true });
    mkdirSync(join(targetPublic, '..'), { recursive: true });
    cpSync(backupPublic, targetPublic, { recursive: true });
  }
  if (existsSync(backupPrivate)) {
    if (existsSync(targetPrivate)) rmSync(targetPrivate, { recursive: true, force: true });
    mkdirSync(join(targetPrivate, '..'), { recursive: true });
    cpSync(backupPrivate, targetPrivate, { recursive: true });
  }
}
