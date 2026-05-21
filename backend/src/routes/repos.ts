import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import { config } from '../config';
import { db, Repo } from '../db';
import { buildTree, safeJoin, detectLanguage } from '../lib/tree';
import { grepRepo } from '../lib/symbols';

const router = Router();

fs.mkdirSync(config.reposDir, { recursive: true });

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const m = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function touchRepo(repoId: number) {
  db.prepare('UPDATE repos SET last_opened_at = datetime(\'now\') WHERE id = ?').run(repoId);
}

function getRepoOr404(id: number): Repo | null {
  const repo = db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as Repo | undefined;
  return repo || null;
}

router.get('/', (_req, res) => {
  const repos = db
    .prepare('SELECT * FROM repos ORDER BY last_opened_at DESC')
    .all() as Repo[];
  const result = repos.map((r) => {
    const count = db
      .prepare('SELECT COUNT(*) as c FROM annotations WHERE repo_id = ?')
      .get(r.id) as { c: number };
    return { ...r, annotation_count: count.c };
  });
  res.json(result);
});

router.post('/clone', async (req, res) => {
  const { url, branch } = req.body || {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }
  const parsed = parseGithubUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: 'invalid GitHub URL' });
  }
  const targetDir = path.join(config.reposDir, parsed.owner, parsed.repo);
  const exists = fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, '.git'));

  try {
    if (!exists) {
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });
      const git = simpleGit();
      const cloneOpts: string[] = ['--depth', '1'];
      if (branch) cloneOpts.push('--branch', branch);
      await git.clone(`https://github.com/${parsed.owner}/${parsed.repo}.git`, targetDir, cloneOpts);
    }
  } catch (e: any) {
    return res.status(500).json({ error: 'clone failed', detail: String(e?.message || e) });
  }

  let actualBranch = branch || null;
  try {
    const git = simpleGit(targetDir);
    const status = await git.status();
    actualBranch = status.current || actualBranch;
  } catch {
    // ignore
  }

  const existing = db
    .prepare('SELECT * FROM repos WHERE source_type = ? AND source_url_or_path = ?')
    .get('github', url) as Repo | undefined;

  let repoRow: Repo;
  if (existing) {
    db.prepare(
      'UPDATE repos SET cloned_path = ?, branch = ?, last_opened_at = datetime(\'now\') WHERE id = ?'
    ).run(targetDir, actualBranch, existing.id);
    repoRow = { ...existing, cloned_path: targetDir, branch: actualBranch };
  } else {
    const info = db
      .prepare(
        'INSERT INTO repos (name, source_type, source_url_or_path, branch, cloned_path) VALUES (?, ?, ?, ?, ?)'
      )
      .run(`${parsed.owner}/${parsed.repo}`, 'github', url, actualBranch, targetDir);
    repoRow = getRepoOr404(Number(info.lastInsertRowid))!;
  }
  res.json(repoRow);
});

router.post('/local', (req, res) => {
  const { path: srcPath, name } = req.body || {};
  if (typeof srcPath !== 'string' || !srcPath.trim()) {
    return res.status(400).json({ error: 'path is required' });
  }
  const abs = path.resolve(srcPath);
  if (!fs.existsSync(abs)) return res.status(400).json({ error: 'path does not exist' });
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) return res.status(400).json({ error: 'path is not a directory' });

  const existing = db
    .prepare('SELECT * FROM repos WHERE source_type = ? AND source_url_or_path = ?')
    .get('local', abs) as Repo | undefined;

  if (existing) {
    touchRepo(existing.id);
    return res.json({ ...existing, last_opened_at: new Date().toISOString() });
  }

  const repoName = name || path.basename(abs);
  const info = db
    .prepare(
      'INSERT INTO repos (name, source_type, source_url_or_path, branch, cloned_path) VALUES (?, ?, ?, ?, ?)'
    )
    .run(repoName, 'local', abs, null, abs);
  const repo = getRepoOr404(Number(info.lastInsertRowid));
  res.json(repo);
});

router.post('/:id/pull', async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepoOr404(id);
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  if (repo.source_type !== 'github') {
    return res.status(400).json({ error: 'pull only supported for github repos' });
  }
  try {
    const git = simpleGit(repo.cloned_path);
    await git.pull();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'pull failed', detail: String(e?.message || e) });
  }
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepoOr404(id);
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  db.prepare('DELETE FROM repos WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.get('/:id/tree', (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepoOr404(id);
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  touchRepo(id);
  const showHidden = req.query.showHidden === 'true';
  const tree = buildTree(repo.cloned_path, { showHidden });
  res.json(tree);
});

router.get('/:id/file', (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepoOr404(id);
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  const relPath = String(req.query.path || '');
  const abs = safeJoin(repo.cloned_path, relPath);
  if (!abs) return res.status(400).json({ error: 'invalid path' });
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'file not found' });
  const stat = fs.statSync(abs);
  if (!stat.isFile()) return res.status(400).json({ error: 'not a file' });
  if (stat.size > 5_000_000) {
    return res.status(413).json({ error: 'file too large (>5MB)' });
  }
  let content: string;
  try {
    content = fs.readFileSync(abs, 'utf-8');
  } catch {
    return res.status(500).json({ error: 'failed to read file' });
  }

  db.prepare(
    `INSERT INTO file_visits (repo_id, file_path, first_visited_at, last_visited_at)
     VALUES (?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(repo_id, file_path) DO UPDATE SET last_visited_at = datetime('now')`
  ).run(id, relPath);

  res.json({
    path: relPath,
    content,
    language: detectLanguage(relPath),
    size: stat.size,
  });
});

router.post('/:id/search', (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepoOr404(id);
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  const { query, limit } = req.body || {};
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  const results = grepRepo(repo.cloned_path, query, typeof limit === 'number' ? limit : 100);
  res.json({ results });
});

export default router;
