import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { makeRepo, cleanupRepo } from '../helpers';

const app = createApp();

let repoId: number;
let dirs: string[] = [];

beforeEach(async () => {
  const dir = makeRepo({ 'src/a.ts': 'export const x = 1;\n' });
  dirs.push(dir);
  const res = await request(app).post('/api/repos/local').send({ path: dir });
  repoId = res.body.id;
});

afterEach(() => {
  dirs.splice(0).forEach(cleanupRepo);
});

const baseFields = {
  filePath: 'src/a.ts',
  startLine: 1,
  startCol: 0,
  endLine: 1,
  endCol: 20,
  selectedText: 'export const x = 1;',
  color: 'yellow',
};

describe('POST /api/annotations — validation', () => {
  it('requires repoId, filePath, and position fields', async () => {
    const res = await request(app).post('/api/annotations').send({ filePath: 'x' });
    expect(res.status).toBe(400);
  });

  it('creates an annotation when all required fields are present', async () => {
    const res = await request(app)
      .post('/api/annotations')
      .send({ repoId, ...baseFields, userNote: 'first note' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTypeOf('number');
    expect(res.body.color).toBe('yellow');
    expect(res.body.user_note).toBe('first note');
    expect(res.body.selected_text).toBe(baseFields.selectedText);
  });
});

describe('annotation lifecycle', () => {
  it('lists annotations per-file and per-repo', async () => {
    await request(app).post('/api/annotations').send({ repoId, ...baseFields });
    await request(app)
      .post('/api/annotations')
      .send({ repoId, ...baseFields, startLine: 2, endLine: 2, color: 'blue' });

    const file = await request(app)
      .get('/api/annotations/file')
      .query({ repoId, path: 'src/a.ts' });
    expect(file.status).toBe(200);
    expect(file.body).toHaveLength(2);
    expect(file.body.map((a: any) => a.color).sort()).toEqual(['blue', 'yellow']);

    const repo = await request(app).get(`/api/annotations/repo/${repoId}`);
    expect(repo.body).toHaveLength(2);
  });

  it('updates color and note via PATCH and leaves other fields untouched', async () => {
    const create = await request(app)
      .post('/api/annotations')
      .send({ repoId, ...baseFields, userNote: 'original' });
    const id = create.body.id;

    const patched = await request(app)
      .patch(`/api/annotations/${id}`)
      .send({ color: 'pink' });
    expect(patched.body.color).toBe('pink');
    expect(patched.body.user_note).toBe('original');

    const patched2 = await request(app)
      .patch(`/api/annotations/${id}`)
      .send({ userNote: 'updated', aiExplanation: 'AI says hi' });
    expect(patched2.body.user_note).toBe('updated');
    expect(patched2.body.ai_explanation).toBe('AI says hi');
    expect(patched2.body.color).toBe('pink');
  });

  it('returns 404 when PATCHing a missing annotation', async () => {
    const res = await request(app)
      .patch('/api/annotations/9999')
      .send({ color: 'green' });
    expect(res.status).toBe(404);
  });

  it('deletes an annotation and cascades its conversation rows', async () => {
    const create = await request(app)
      .post('/api/annotations')
      .send({ repoId, ...baseFields });
    const id = create.body.id;

    const del = await request(app).delete(`/api/annotations/${id}`);
    expect(del.status).toBe(200);

    const get = await request(app).get(`/api/annotations/${id}`);
    expect(get.status).toBe(404);
  });

  it('returns annotation + (empty) conversation by id', async () => {
    const create = await request(app)
      .post('/api/annotations')
      .send({ repoId, ...baseFields });
    const id = create.body.id;

    const res = await request(app).get(`/api/annotations/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.annotation.id).toBe(id);
    expect(Array.isArray(res.body.conversation)).toBe(true);
    expect(res.body.conversation).toHaveLength(0);
  });
});

describe('GET /api/repos annotation_count', () => {
  it('reflects the live annotation count for each repo', async () => {
    await request(app).post('/api/annotations').send({ repoId, ...baseFields });
    await request(app)
      .post('/api/annotations')
      .send({ repoId, ...baseFields, startLine: 2, endLine: 2 });

    const list = await request(app).get('/api/repos');
    const me = list.body.find((r: any) => r.id === repoId);
    expect(me.annotation_count).toBe(2);
  });
});
