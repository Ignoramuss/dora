import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from './config';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('github', 'local')),
  source_url_or_path TEXT NOT NULL,
  branch TEXT,
  cloned_path TEXT NOT NULL,
  last_opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  selected_text TEXT,
  color TEXT NOT NULL DEFAULT 'yellow',
  user_note TEXT,
  ai_explanation TEXT,
  kind TEXT NOT NULL DEFAULT 'highlight',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_annotations_repo_file ON annotations(repo_id, file_path);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_annotation ON conversations(annotation_id);

CREATE TABLE IF NOT EXISTS concept_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  node_type TEXT,
  file_path TEXT,
  line_number INTEGER,
  x REAL,
  y REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS concept_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  source_node_id INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
  edge_type TEXT,
  label TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS architecture_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  scope_path TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_visits (
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  first_visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (repo_id, file_path)
);
`);

export type Repo = {
  id: number;
  name: string;
  source_type: 'github' | 'local';
  source_url_or_path: string;
  branch: string | null;
  cloned_path: string;
  last_opened_at: string;
  created_at: string;
};

export type Annotation = {
  id: number;
  repo_id: number;
  file_path: string;
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
  selected_text: string | null;
  color: string;
  user_note: string | null;
  ai_explanation: string | null;
  kind: string;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: number;
  annotation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};
