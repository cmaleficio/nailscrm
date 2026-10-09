import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, copyFileSync, existsSync } from 'fs';

export function backupDb(srcDb: string, outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const db = new Database(srcDb, { readonly: true });
  const target = join(outDir, 'dev.db');
  db.backup(target);
  db.close();
  ['dev.db-wal','dev.db-shm'].forEach(f => {
    const s = srcDb.replace(/dev\\.db$/, f);
    const d = join(outDir, f);
    if (existsSync(s)) copyFileSync(s, d);
  });
  return target;
}
