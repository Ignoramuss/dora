import { beforeEach } from 'vitest';
import { db } from '../src/db';

// Wipe DB state between every test so suites stay isolated even though they
// share an in-memory SQLite within the worker.
beforeEach(() => {
  db.exec(`
    DELETE FROM conversations;
    DELETE FROM annotations;
    DELETE FROM concept_edges;
    DELETE FROM concept_nodes;
    DELETE FROM journal_entries;
    DELETE FROM architecture_summaries;
    DELETE FROM file_visits;
    DELETE FROM repos;
    DELETE FROM sqlite_sequence;
  `);
});
