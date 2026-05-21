# CodeLens (dora)

An AI-powered codebase explorer for building mental models of unfamiliar projects.

Browse any repo's file tree, read syntax-highlighted code, highlight any span,
and get contextual AI explanations — with every annotation persisted as an
evolving learning layer.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Shiki
- **Backend**: Node + Express + TypeScript + better-sqlite3
- **AI**: Anthropic Claude (`claude-sonnet-4-5` by default)
- **Git**: simple-git for cloning GitHub repos

## Setup

```bash
npm install
cp .env.example .env  # then set ANTHROPIC_API_KEY
npm run dev
```

- Frontend: <http://localhost:5173>
- Backend:  <http://localhost:3001>

## Environment

| Variable | Description | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Required for AI features | — |
| `ANTHROPIC_MODEL` | Override model id | `claude-sonnet-4-5` |
| `PORT` | Backend port | `3001` |
| `REPOS_DIR` | Where GitHub clones live | `./.repos` |
| `DB_PATH` | SQLite database file | `./data/codelens.db` |

## Project layout

```
backend/   Express API + SQLite
frontend/  React UI (Vite)
.repos/    Cloned GitHub repos (gitignored)
data/      SQLite database (gitignored)
```

Build order follows Phase 1 → 4 from the spec; Phase 1 (MVP) and Phase 2
essentials (highlights, tabs, follow-ups, trace) are implemented.
