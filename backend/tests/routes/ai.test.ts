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

// These tests verify *validation and error handling* without making real
// Anthropic calls. The test env has ANTHROPIC_API_KEY="" so any call that
// reaches the SDK throws and we get a 500 — which is the contract the
// frontend depends on.

describe('AI route validation', () => {
  it('POST /api/ai/explain rejects missing fields', async () => {
    const res = await request(app).post('/api/ai/explain').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/syntax rejects missing fields', async () => {
    const res = await request(app).post('/api/ai/syntax').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/trace rejects missing fields', async () => {
    const res = await request(app).post('/api/ai/trace').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/architecture rejects missing repoId', async () => {
    const res = await request(app).post('/api/ai/architecture').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/followup rejects missing fields', async () => {
    const res = await request(app).post('/api/ai/followup').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 if repoId does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        repoId: 999999,
        filePath: 'src/a.ts',
        startLine: 1,
        endLine: 1,
        selectedText: 'x',
      });
    expect(res.status).toBe(404);
  });

  it('returns 500 with a clear error when ANTHROPIC_API_KEY is not set', async () => {
    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        repoId,
        filePath: 'src/a.ts',
        startLine: 1,
        endLine: 1,
        selectedText: 'export const x = 1;',
      });
    expect(res.status).toBe(500);
    expect(res.body.detail || res.body.error).toMatch(/ANTHROPIC_API_KEY/i);
  });
});
