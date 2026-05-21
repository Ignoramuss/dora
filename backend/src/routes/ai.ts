import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db, Repo, Annotation, ConversationMessage } from '../db';
import { safeJoin, detectLanguage, buildTree, TreeNode } from '../lib/tree';
import { findSymbol } from '../lib/symbols';
import { callClaude, ChatMessage } from '../lib/anthropic';
import {
  EXPLAIN_SYSTEM,
  SYNTAX_SYSTEM,
  TRACE_SYSTEM,
  ARCHITECTURE_SYSTEM,
  buildExplainUserMessage,
  buildSyntaxUserMessage,
  buildTraceUserMessage,
  buildArchitectureUserMessage,
} from '../lib/prompts';

const router = Router();

function getRepo(id: number): Repo | null {
  return (db.prepare('SELECT * FROM repos WHERE id = ?').get(id) as Repo) || null;
}

function readReadme(repoPath: string): string {
  const candidates = ['README.md', 'README.rst', 'README.txt', 'README', 'readme.md'];
  for (const name of candidates) {
    const p = path.join(repoPath, name);
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf-8').slice(0, 4000);
      } catch {
        // ignore
      }
    }
  }
  return '';
}

function readFileSafe(repoPath: string, relPath: string, maxBytes = 200_000): string {
  const abs = safeJoin(repoPath, relPath);
  if (!abs || !fs.existsSync(abs)) return '';
  const stat = fs.statSync(abs);
  if (!stat.isFile() || stat.size > maxBytes) return '';
  try {
    return fs.readFileSync(abs, 'utf-8');
  } catch {
    return '';
  }
}

function priorAnnotationsText(repoId: number, filePath: string): string {
  const rows = db
    .prepare(
      `SELECT start_line, end_line, color, user_note, ai_explanation
       FROM annotations
       WHERE repo_id = ? AND file_path = ?
       ORDER BY start_line ASC
       LIMIT 20`
    )
    .all(repoId, filePath) as Pick<
      Annotation,
      'start_line' | 'end_line' | 'color' | 'user_note' | 'ai_explanation'
    >[];
  if (!rows.length) return '';
  return rows
    .map(
      (r) =>
        `- Lines ${r.start_line}–${r.end_line} [${r.color}]: ${
          r.user_note ? `note: "${r.user_note}". ` : ''
        }${r.ai_explanation ? `previously explained: ${r.ai_explanation.slice(0, 200)}…` : ''}`
    )
    .join('\n');
}

router.post('/explain', async (req, res) => {
  const { repoId, filePath, startLine, endLine, selectedText } = req.body || {};
  if (!repoId || !filePath || !selectedText) {
    return res.status(400).json({ error: 'repoId, filePath, selectedText are required' });
  }
  const repo = getRepo(Number(repoId));
  if (!repo) return res.status(404).json({ error: 'repo not found' });

  const fileContent = readFileSafe(repo.cloned_path, filePath);
  const readme = readReadme(repo.cloned_path);
  const language = detectLanguage(filePath);
  const prior = priorAnnotationsText(repo.id, filePath);

  const userMsg = buildExplainUserMessage({
    language,
    repoName: repo.name,
    filePath,
    fileContent: fileContent.slice(0, 60_000),
    readmeExcerpt: readme,
    priorAnnotations: prior,
    startLine: Number(startLine) || 1,
    endLine: Number(endLine) || 1,
    selectedCode: String(selectedText),
  });

  try {
    const text = await callClaude(EXPLAIN_SYSTEM, [{ role: 'user', content: userMsg }]);
    res.json({ explanation: text });
  } catch (e: any) {
    res.status(500).json({ error: 'AI request failed', detail: String(e?.message || e) });
  }
});

router.post('/syntax', async (req, res) => {
  const { filePath, selectedText } = req.body || {};
  if (!filePath || !selectedText) {
    return res.status(400).json({ error: 'filePath, selectedText are required' });
  }
  const language = detectLanguage(filePath);
  const userMsg = buildSyntaxUserMessage({ language, selectedCode: String(selectedText) });
  try {
    const text = await callClaude(SYNTAX_SYSTEM, [{ role: 'user', content: userMsg }]);
    res.json({ explanation: text });
  } catch (e: any) {
    res.status(500).json({ error: 'AI request failed', detail: String(e?.message || e) });
  }
});

router.post('/trace', async (req, res) => {
  const { repoId, filePath, startLine, endLine, selectedText, symbol } = req.body || {};
  if (!repoId || !filePath || !selectedText) {
    return res.status(400).json({ error: 'repoId, filePath, selectedText are required' });
  }
  const repo = getRepo(Number(repoId));
  if (!repo) return res.status(404).json({ error: 'repo not found' });

  const sym =
    (typeof symbol === 'string' && symbol.trim()) ||
    (String(selectedText).match(/[A-Za-z_][A-Za-z0-9_]*/)?.[0] ?? '');

  const matches = sym ? findSymbol(repo.cloned_path, sym, 6) : [];
  const definitions = matches.filter((m) => m.kind === 'definition');
  const language = detectLanguage(filePath);

  const callFileContent = readFileSafe(repo.cloned_path, filePath);
  const callLines = callFileContent.split('\n');
  const sl = Math.max(0, (Number(startLine) || 1) - 4);
  const el = Math.min(callLines.length, (Number(endLine) || 1) + 4);
  const callContext = callLines.slice(sl, el).join('\n');

  const userMsg = buildTraceUserMessage({
    language,
    symbol: sym || String(selectedText),
    callFile: filePath,
    callLine: Number(startLine) || 1,
    callContext,
    definitions: definitions.map((d) => ({ file: d.file, line: d.line, snippet: d.snippet })),
  });

  try {
    const text = await callClaude(TRACE_SYSTEM, [{ role: 'user', content: userMsg }]);
    res.json({
      explanation: text,
      symbol: sym,
      definitions: matches,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'AI request failed', detail: String(e?.message || e) });
  }
});

router.post('/architecture', async (req, res) => {
  const { repoId, scopePath } = req.body || {};
  if (!repoId) return res.status(400).json({ error: 'repoId required' });
  const repo = getRepo(Number(repoId));
  if (!repo) return res.status(404).json({ error: 'repo not found' });

  const tree = buildTree(repo.cloned_path);
  const treeText = renderTreeText(tree, 4);

  const keyFileCandidates = [
    'README.md',
    'package.json',
    'go.mod',
    'Cargo.toml',
    'pyproject.toml',
    'setup.py',
    'pom.xml',
    'build.gradle',
    'main.go',
    'cmd/main.go',
    'src/main.rs',
    'src/index.ts',
    'src/index.js',
    'src/App.tsx',
    'main.py',
    'app.py',
  ];
  const keyFiles: { path: string; content: string }[] = [];
  for (const c of keyFileCandidates) {
    const content = readFileSafe(repo.cloned_path, c, 20_000);
    if (content) keyFiles.push({ path: c, content: content.slice(0, 8_000) });
  }

  const userMsg = buildArchitectureUserMessage({
    repoName: repo.name,
    scopePath: scopePath || '',
    fileTreeText: treeText,
    keyFiles,
  });

  try {
    const text = await callClaude(
      ARCHITECTURE_SYSTEM,
      [{ role: 'user', content: userMsg }],
      4096
    );
    db.prepare(
      `INSERT INTO architecture_summaries (repo_id, scope_path, content_markdown)
       VALUES (?, ?, ?)`
    ).run(repo.id, scopePath || '', text);
    res.json({ summary: text });
  } catch (e: any) {
    res.status(500).json({ error: 'AI request failed', detail: String(e?.message || e) });
  }
});

router.post('/followup', async (req, res) => {
  const { annotationId, question } = req.body || {};
  if (!annotationId || !question) {
    return res.status(400).json({ error: 'annotationId, question required' });
  }
  const annotation = db
    .prepare('SELECT * FROM annotations WHERE id = ?')
    .get(annotationId) as Annotation | undefined;
  if (!annotation) return res.status(404).json({ error: 'annotation not found' });
  const repo = getRepo(annotation.repo_id);
  if (!repo) return res.status(404).json({ error: 'repo not found' });

  const language = detectLanguage(annotation.file_path);
  const fileContent = readFileSafe(repo.cloned_path, annotation.file_path);

  const history = db
    .prepare(
      'SELECT role, content FROM conversations WHERE annotation_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(annotationId) as Pick<ConversationMessage, 'role' | 'content'>[];

  const messages: ChatMessage[] = [];
  // Seed with the original selection + initial explanation
  messages.push({
    role: 'user',
    content: `Original selection from \`${annotation.file_path}\` (lines ${annotation.start_line}-${annotation.end_line}):
\`\`\`${language}
${annotation.selected_text || ''}
\`\`\`

File context (truncated):
\`\`\`${language}
${fileContent.slice(0, 30_000)}
\`\`\`

Please answer follow-up questions about this code.`,
  });
  if (annotation.ai_explanation) {
    messages.push({ role: 'assistant', content: annotation.ai_explanation });
  }
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: String(question) });

  try {
    const text = await callClaude(EXPLAIN_SYSTEM, messages);
    db.prepare(
      'INSERT INTO conversations (annotation_id, role, content) VALUES (?, ?, ?)'
    ).run(annotationId, 'user', String(question));
    db.prepare(
      'INSERT INTO conversations (annotation_id, role, content) VALUES (?, ?, ?)'
    ).run(annotationId, 'assistant', text);
    res.json({ response: text });
  } catch (e: any) {
    res.status(500).json({ error: 'AI request failed', detail: String(e?.message || e) });
  }
});

function renderTreeText(node: TreeNode, maxDepth: number, depth = 0, prefix = ''): string {
  if (depth === 0) {
    const lines = [node.name + '/'];
    for (const child of node.children || []) {
      lines.push(renderTreeText(child, maxDepth, depth + 1, ''));
    }
    return lines.filter(Boolean).join('\n');
  }
  if (depth > maxDepth) return '';
  const indent = '  '.repeat(depth - 1);
  if (node.type === 'file') {
    return `${indent}${node.name}`;
  }
  const lines = [`${indent}${node.name}/`];
  for (const child of node.children || []) {
    const sub = renderTreeText(child, maxDepth, depth + 1, prefix);
    if (sub) lines.push(sub);
  }
  return lines.join('\n');
}

export default router;
