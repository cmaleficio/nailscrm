import { cpSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export function copyUploads(publicSrc: string, privateSrc: string, outDir: string) {
  const pubOut = join(outDir, 'public', 'uploads');
  const privOut = join(outDir, 'private', 'uploads');
  if (existsSync(publicSrc)) {
    mkdirSync(pubOut, { recursive: true });
    cpSync(publicSrc, pubOut, { recursive: true });
  }
  if (existsSync(privateSrc)) {
    mkdirSync(privOut, { recursive: true });
    cpSync(privateSrc, privOut, { recursive: true });
  }
}
