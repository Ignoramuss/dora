import fs from 'fs';
import path from 'path';
import ignore, { Ignore } from 'ignore';

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: TreeNode[];
};

const DEFAULT_HIDDEN = [
  'node_modules',
  '.git',
  'vendor',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  '.parcel-cache',
  'target',
  'out',
  '.idea',
  '.vscode',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  '.venv',
  'venv',
];

const LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'Gemfile.lock',
  'Pipfile.lock',
  'poetry.lock',
  'composer.lock',
  'go.sum',
]);

function loadGitignore(rootPath: string): Ignore {
  const ig = ignore();
  const gitignorePath = path.join(rootPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
    } catch {
      // ignore
    }
  }
  return ig;
}

export function buildTree(
  rootPath: string,
  options: { showHidden?: boolean } = {}
): TreeNode {
  const showHidden = options.showHidden ?? false;
  const ig = loadGitignore(rootPath);

  const walk = (absPath: string, relPath: string): TreeNode | null => {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      return null;
    }

    const name = path.basename(absPath) || rootPath;

    if (!showHidden) {
      if (DEFAULT_HIDDEN.includes(name)) return null;
      if (LOCK_FILES.has(name)) return null;
      if (name.startsWith('.') && relPath !== '') return null;
      // The `ignore` library distinguishes file vs dir by trailing slash, so
      // patterns like `build/` only match when we query with that slash.
      if (relPath) {
        const isDir = stat.isDirectory();
        if (ig.ignores(relPath)) return null;
        if (isDir && ig.ignores(relPath + '/')) return null;
      }
    }

    if (stat.isDirectory()) {
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(absPath);
      } catch {
        return null;
      }
      const children: TreeNode[] = [];
      for (const entry of entries) {
        const childAbs = path.join(absPath, entry);
        const childRel = relPath ? path.join(relPath, entry) : entry;
        const node = walk(childAbs, childRel);
        if (node) children.push(node);
      }
      children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return {
        name,
        path: relPath,
        type: 'dir',
        children,
      };
    }

    if (stat.isFile()) {
      return {
        name,
        path: relPath,
        type: 'file',
        size: stat.size,
      };
    }
    return null;
  };

  const root = walk(rootPath, '');
  if (!root) {
    return { name: path.basename(rootPath), path: '', type: 'dir', children: [] };
  }
  root.name = path.basename(rootPath);
  return root;
}

export function safeJoin(rootPath: string, relPath: string): string | null {
  // Reject absolute paths outright — callers should always be passing
  // repo-relative paths. Treating an absolute path as relative would be a
  // confusing footgun.
  if (path.isAbsolute(relPath)) return null;
  const normalized = path.normalize(relPath);
  // path.normalize collapses interior `..` but leaves a leading `..` intact;
  // anything that escapes the root must be rejected.
  if (normalized.split(path.sep)[0] === '..') return null;
  const target = path.resolve(rootPath, normalized);
  const root = path.resolve(rootPath);
  if (!target.startsWith(root + path.sep) && target !== root) return null;
  return target;
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.zig': 'zig',
    '.hs': 'haskell',
    '.ex': 'elixir',
    '.exs': 'elixir',
    '.erl': 'erlang',
    '.lua': 'lua',
    '.r': 'r',
    '.jl': 'julia',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
    '.mdx': 'mdx',
    '.dockerfile': 'dockerfile',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.proto': 'protobuf',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.dart': 'dart',
    '.clj': 'clojure',
    '.fs': 'fsharp',
    '.nim': 'nim',
    '.ml': 'ocaml',
  };
  if (base === 'Dockerfile') return 'dockerfile';
  if (base === 'Makefile') return 'makefile';
  return map[ext] || 'text';
}
