import fs from 'fs';
import os from 'os';
import path from 'path';

export type FileMap = Record<string, string>;

export function makeRepo(files: FileMap, name = 'test-repo'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `codelens-repo-${name}-`));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

export function cleanupRepo(dir: string): void {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
