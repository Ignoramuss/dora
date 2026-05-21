import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { makeRepo, cleanupRepo } from '../helpers';

const app = createApp();

let repoId: number;
let dirs: string[] = [];

beforeEach(async () => {
  const dir = makeRepo({ 'README.md': 'x' });
  dirs.push(dir);
  const res = await request(app).post('/api/repos/local').send({ path: dir });
  repoId = res.body.id;
});

afterEach(() => {
  dirs.splice(0).forEach(cleanupRepo);
});

describe('journal endpoints', () => {
  it('rejects creating a journal entry without repoId or content', async () => {
    expect((await request(app).post('/api/journal').send({})).status).toBe(400);
    expect((await request(app).post('/api/journal').send({ repoId })).status).toBe(400);
  });

  it('creates, lists, updates and deletes a journal entry', async () => {
    const create = await request(app)
      .post('/api/journal')
      .send({ repoId, content: '# day 1\n\nLooking at the parser.' });
    expect(create.status).toBe(200);
    const id = (create.body as any).id;
    expect(typeof id).toBe('number');

    const list = await request(app).get(`/api/journal/${repoId}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].content_markdown).toMatch(/day 1/);

    const upd = await request(app)
      .patch(`/api/journal/${id}`)
      .send({ content: 'updated content' });
    expect(upd.status).toBe(200);
    expect((upd.body as any).content_markdown).toBe('updated content');

    const del = await request(app).delete(`/api/journal/${id}`);
    expect(del.status).toBe(200);

    const list2 = await request(app).get(`/api/journal/${repoId}`);
    expect(list2.body).toHaveLength(0);
  });

  it('isolates entries per repo', async () => {
    const otherDir = makeRepo({ 'x.ts': 'x' });
    dirs.push(otherDir);
    const other = await request(app).post('/api/repos/local').send({ path: otherDir });

    await request(app).post('/api/journal').send({ repoId, content: 'A' });
    await request(app).post('/api/journal').send({ repoId: other.body.id, content: 'B' });

    const a = await request(app).get(`/api/journal/${repoId}`);
    const b = await request(app).get(`/api/journal/${other.body.id}`);
    expect(a.body.map((e: any) => e.content_markdown)).toEqual(['A']);
    expect(b.body.map((e: any) => e.content_markdown)).toEqual(['B']);
  });
});
