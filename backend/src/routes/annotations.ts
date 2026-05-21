import { Router } from 'express';
import { db, Annotation, ConversationMessage } from '../db';

const router = Router();

router.get('/repo/:repoId', (req, res) => {
  const repoId = Number(req.params.repoId);
  const rows = db
    .prepare('SELECT * FROM annotations WHERE repo_id = ? ORDER BY file_path, start_line')
    .all(repoId) as Annotation[];
  res.json(rows);
});

router.get('/file', (req, res) => {
  const repoId = Number(req.query.repoId);
  const filePath = String(req.query.path || '');
  if (!repoId || !filePath) {
    return res.status(400).json({ error: 'repoId, path required' });
  }
  const rows = db
    .prepare(
      'SELECT * FROM annotations WHERE repo_id = ? AND file_path = ? ORDER BY start_line, start_col'
    )
    .all(repoId, filePath) as Annotation[];
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ann = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as Annotation | undefined;
  if (!ann) return res.status(404).json({ error: 'not found' });
  const conv = db
    .prepare(
      'SELECT * FROM conversations WHERE annotation_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(id) as ConversationMessage[];
  res.json({ annotation: ann, conversation: conv });
});

router.post('/', (req, res) => {
  const {
    repoId,
    filePath,
    startLine,
    startCol,
    endLine,
    endCol,
    selectedText,
    color,
    userNote,
    aiExplanation,
    kind,
  } = req.body || {};
  if (
    repoId == null ||
    !filePath ||
    startLine == null ||
    startCol == null ||
    endLine == null ||
    endCol == null
  ) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  const info = db
    .prepare(
      `INSERT INTO annotations
        (repo_id, file_path, start_line, start_col, end_line, end_col,
         selected_text, color, user_note, ai_explanation, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(repoId),
      filePath,
      Number(startLine),
      Number(startCol),
      Number(endLine),
      Number(endCol),
      selectedText || null,
      color || 'yellow',
      userNote || null,
      aiExplanation || null,
      kind || 'highlight'
    );
  const row = db
    .prepare('SELECT * FROM annotations WHERE id = ?')
    .get(info.lastInsertRowid) as Annotation;
  res.json(row);
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as
    | Annotation
    | undefined;
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { color, userNote, aiExplanation } = req.body || {};
  db.prepare(
    `UPDATE annotations
     SET color = COALESCE(?, color),
         user_note = COALESCE(?, user_note),
         ai_explanation = COALESCE(?, ai_explanation),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(color ?? null, userNote ?? null, aiExplanation ?? null, id);
  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
