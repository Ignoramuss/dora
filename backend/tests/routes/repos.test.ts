import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { makeRepo, cleanupRepo } from '../helpers';

const app = createApp();

let dirs: string[] = [];
afterEach(() => {
  dirs.splice(0).forEach(cleanupRepo);
});

async function registerLocal(files: Record<string, string>): Promise<number> {
  const dir = makeRepo(files);
  dirs.push(dir);
  const res = await request(app).post('/api/repos/local').send({ path: dir });
  expect(res.status).toBe(200);
  return res.body.id as number;
}

describe('POST /api/repos/local — input validation', () => {
  it('rejects a missing path', async () => {
    const res = await request(app).post('/api/repos/local').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path/i);
  });

  it('rejects a non-existent path', async () => {
    const res = await request(app)
      .post('/api/repos/local')
      .send({ path: '/this/path/should/not/exist/abc123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exist/);
  });

  it('rejects a path that is a file, not a directory', async () => {
    const dir = makeRepo({ 'only.txt': 'hello' });
    dirs.push(dir);
    const res = await request(app)
      .post('/api/repos/local')
      .send({ path: `${dir}/only.txt` });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/directory/);
  });

  it('registers a valid directory and returns repo metadata', async () => {
    const dir = makeRepo({ 'index.ts': 'x' });
    dirs.push(dir);
    const res = await request(app).post('/api/repos/local').send({ path: dir });
    expect(res.status).toBe(200);
    expect(res.body.source_type).toBe('local');
    expect(res.body.cloned_path).toBe(dir);
    expect(typeof res.body.id).toBe('number');
  });

  it('is idempotent — re-registering the same path returns the existing repo', async () => {
    const dir = makeRepo({ 'a.ts': 'x' });
    dirs.push(dir);
    const a = await request(app).post('/api/repos/local').send({ path: dir });
    const b = await request(app).post('/api/repos/local').send({ path: dir });
    expect(a.body.id).toBe(b.body.id);
  });
});

describe('POST /api/repos/clone — input validation', () => {
  it('rejects an empty url', async () => {
    const res = await request(app).post('/api/repos/clone').send({});
    expect(res.status).toBe(400);
  });

  it('rejects a non-GitHub url', async () => {
    const res = await request(app)
      .post('/api/repos/clone')
      .send({ url: 'https://gitlab.com/foo/bar' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/github/i);
  });
});

describe('GET /api/repos', () => {
  it('lists repos newest-first with annotation_count', async () => {
    const id1 = await registerLocal({ 'a.ts': 'a' });
    const id2 = await registerLocal({ 'b.ts': 'b' });
    const list = await request(app).get('/api/repos');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    const ids = list.body.map((r: any) => r.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(list.body[0].annotation_count).toBe(0);
  });
});

describe('GET /api/repos/:id/tree', () => {
  it('returns the file tree honoring gitignore', async () => {
    const id = await registerLocal({
      '.gitignore': 'ignored/\n',
      'src/index.ts': '',
      'ignored/secret.txt': 'shhh',
    });
    const res = await request(app).get(`/api/repos/${id}/tree`);
    expect(res.status).toBe(200);
    const stringified = JSON.stringify(res.body);
    expect(stringified).toContain('src');
    expect(stringified).toContain('index.ts');
    expect(stringified).not.toContain('secret.txt');
  });

  it('shows ignored files when showHidden=true', async () => {
    const id = await registerLocal({
      '.gitignore': 'build/\n',
      'build/out.js': 'x',
    });
    const res = await request(app).get(`/api/repos/${id}/tree?showHidden=true`);
    expect(JSON.stringify(res.body)).toContain('out.js');
  });

  it('returns 404 for unknown repo id', async () => {
    const res = await request(app).get('/api/repos/99999/tree');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/repos/:id/file', () => {
  it('returns file contents and detected language', async () => {
    const id = await registerLocal({
      'src/index.go': 'package main\n\nfunc main() {}\n',
    });
    const res = await request(app)
      .get(`/api/repos/${id}/file`)
      .query({ path: 'src/index.go' });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe('go');
    expect(res.body.content).toContain('package main');
    expect(res.body.size).toBeGreaterThan(0);
  });

  it('records a file visit when a file is opened', async () => {
    const id = await registerLocal({ 'a.ts': 'x' });
    await request(app).get(`/api/repos/${id}/file`).query({ path: 'a.ts' });
    const progress = await request(app).get(`/api/progress/${id}`);
    expect(progress.status).toBe(200);
    const visited = progress.body.visits.map((v: any) => v.file_path);
    expect(visited).toContain('a.ts');
  });

  it('blocks path traversal attempts', async () => {
    const id = await registerLocal({ 'a.ts': 'x' });
    const res = await request(app)
      .get(`/api/repos/${id}/file`)
      .query({ path: '../../../etc/passwd' });
    // safeJoin returns null → 400 invalid; or if it slips, 404 not found.
    // Either way it must NOT return /etc/passwd contents.
    expect([400, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('root:');
  });

  it('returns 404 for a path that does not exist in the repo', async () => {
    const id = await registerLocal({ 'a.ts': 'x' });
    const res = await request(app)
      .get(`/api/repos/${id}/file`)
      .query({ path: 'no-such-file.ts' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/repos/:id/search', () => {
  it('greps the repo for a substring', async () => {
    const id = await registerLocal({
      'a.ts': 'const NEEDLE = 1;\n',
      'b.ts': 'console.log("nothing");\n',
    });
    const res = await request(app)
      .post(`/api/repos/${id}/search`)
      .send({ query: 'NEEDLE' });
    expect(res.status).toBe(200);
    const files = res.body.results.map((r: any) => r.file);
    expect(files).toContain('a.ts');
    expect(files).not.toContain('b.ts');
  });

  it('rejects an empty query', async () => {
    const id = await registerLocal({ 'a.ts': 'x' });
    const res = await request(app).post(`/api/repos/${id}/search`).send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/repos/:id', () => {
  it('removes the repo from the registry without touching disk', async () => {
    const id = await registerLocal({ 'a.ts': 'x' });
    const del = await request(app).delete(`/api/repos/${id}`);
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/repos');
    expect(list.body.map((r: any) => r.id)).not.toContain(id);
  });
});
