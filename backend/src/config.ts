import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const rawDbPath = process.env.DB_PATH || './data/codelens.db';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  reposDir: path.resolve(process.env.REPOS_DIR || './.repos'),
  // ':memory:' is a SQLite sentinel — must be passed through verbatim so
  // better-sqlite3 opens an in-memory DB instead of a literal file.
  dbPath: rawDbPath === ':memory:' ? ':memory:' : path.resolve(rawDbPath),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
};
