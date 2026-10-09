import { spawn } from 'child_process';
export async function rcloneTest(remote: string, folder: string) {
  const args = ['lsd', remote + ':' + folder];
  return new Promise((res) => {
    const p = spawn('rclone', args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (c) => res({ code: c, out, err }));
  });
}
