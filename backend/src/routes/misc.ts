import { Router } from 'express';
import { db } from '../db';

const router = Router();

// Journal
router.get('/journal/:repoId', (req, res) => {
  const repoId = Number(req.params.repoId);
  const rows = db
    .prepare('SELECT * FROM journal_entries WHERE repo_id = ? ORDER BY created_at DESC')
    .all(repoId);
  res.json(rows);
});

router.post('/journal', (req, res) => {
  const { repoId, content } = req.body || {};
  if (!repoId || !content) return res.status(400).json({ error: 'repoId, content required' });
  const info = db
    .prepare('INSERT INTO journal_entries (repo_id, content_markdown) VALUES (?, ?)')
    .run(Number(repoId), String(content));
  const row = db
    .prepare('SELECT * FROM journal_entries WHERE id = ?')
    .get(info.lastInsertRowid);
  res.json(row);
});

router.patch('/journal/:id', (req, res) => {
  const id = Number(req.params.id);
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });
  db.prepare(
    `UPDATE journal_entries SET content_markdown = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(String(content), id);
  const row = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  res.json(row);
});

router.delete('/journal/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Architecture summaries
router.get('/architecture/:repoId', (req, res) => {
  const repoId = Number(req.params.repoId);
  const rows = db
    .prepare(
      'SELECT * FROM architecture_summaries WHERE repo_id = ? ORDER BY updated_at DESC'
    )
    .all(repoId);
  res.json(rows);
});

router.patch('/architecture/:id', (req, res) => {
  const id = Number(req.params.id);
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });
  db.prepare(
    `UPDATE architecture_summaries SET content_markdown = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(String(content), id);
  const row = db.prepare('SELECT * FROM architecture_summaries WHERE id = ?').get(id);
  res.json(row);
});

router.delete('/architecture/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM architecture_summaries WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Progress
router.get('/progress/:repoId', (req, res) => {
  const repoId = Number(req.params.repoId);
  const visits = db
    .prepare('SELECT file_path, first_visited_at, last_visited_at FROM file_visits WHERE repo_id = ?')
    .all(repoId);
  const annotated = db
    .prepare(
      'SELECT file_path, COUNT(*) as count FROM annotations WHERE repo_id = ? GROUP BY file_path'
    )
    .all(repoId);
  res.json({ visits, annotated });
});

// Concept map
router.get('/concepts/:repoId', (req, res) => {
  const repoId = Number(req.params.repoId);
  const nodes = db.prepare('SELECT * FROM concept_nodes WHERE repo_id = ?').all(repoId);
  const edges = db.prepare('SELECT * FROM concept_edges WHERE repo_id = ?').all(repoId);
  res.json({ nodes, edges });
});

router.post('/concepts/node', (req, res) => {
  const { repoId, label, nodeType, filePath, lineNumber, x, y } = req.body || {};
  if (!repoId || !label) return res.status(400).json({ error: 'repoId, label required' });
  const info = db
    .prepare(
      `INSERT INTO concept_nodes (repo_id, label, node_type, file_path, line_number, x, y)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(repoId),
      String(label),
      nodeType || null,
      filePath || null,
      lineNumber || null,
      x ?? null,
      y ?? null
    );
  const row = db.prepare('SELECT * FROM concept_nodes WHERE id = ?').get(info.lastInsertRowid);
  res.json(row);
});

router.post('/concepts/edge', (req, res) => {
  const { repoId, source, target, edgeType, label } = req.body || {};
  if (!repoId || !source || !target) {
    return res.status(400).json({ error: 'repoId, source, target required' });
  }
  const info = db
    .prepare(
      `INSERT INTO concept_edges (repo_id, source_node_id, target_node_id, edge_type, label)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(Number(repoId), Number(source), Number(target), edgeType || null, label || null);
  const row = db.prepare('SELECT * FROM concept_edges WHERE id = ?').get(info.lastInsertRowid);
  res.json(row);
});

router.delete('/concepts/node/:id', (req, res) => {
  db.prepare('DELETE FROM concept_nodes WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/concepts/edge/:id', (req, res) => {
  db.prepare('DELETE FROM concept_edges WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
