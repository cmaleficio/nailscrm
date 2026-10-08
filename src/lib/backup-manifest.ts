import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

export type Manifest = {
  id: string;
  timestamp: string;
  type: 'manual'|'scheduled';
  frequency?: string|null;
  driveScope?: string|null;
  backupPath: string;
  dbZipPath?: string|null;
  dbSizeBytes?: number|null;
  publicSizeBytes?: number|null;
  privateSizeBytes?: number|null;
  driveUploaded?: number|null;
  drivePath?: string|null;
  status: string;
  durationMs?: number|null;
  triggeredBy?: string|null;
  sha256?: string|null;
};

export function sha256File(p: string) {
  const buf = readFileSync(p);
  return createHash('sha256').update(buf).digest('hex');
}

export function writeManifest(p: string, m: Manifest) {
  writeFileSync(p, JSON.stringify(m, null, 2));
}

export function readManifest(p: string): Manifest {
  return JSON.parse(readFileSync(p, 'utf8'));
}
