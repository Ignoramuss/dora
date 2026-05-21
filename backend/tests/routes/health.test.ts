import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('GET /api/health', () => {
  it('reports ok and exposes the configured model', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.aiConfigured).toBe('boolean');
    expect(res.body.model).toBe('claude-sonnet-4-5');
  });

  it('reports aiConfigured=false when ANTHROPIC_API_KEY is unset', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.aiConfigured).toBe(false);
  });
});
