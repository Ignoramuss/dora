import fs from 'fs';
import path from 'path';
import { buildTree, TreeNode } from './tree';

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
  '.cs', '.rb', '.php', '.swift', '.zig', '.hs',
  '.ex', '.exs', '.erl', '.lua', '.r', '.jl',
  '.dart', '.clj', '.fs', '.nim', '.ml', '.sh', '.bash',
]);

function collectFiles(node: TreeNode, acc: string[]): void {
  if (node.type === 'file') {
    if (CODE_EXTS.has(path.extname(node.name).toLowerCase())) {
      acc.push(node.path);
    }
    return;
  }
  for (const child of node.children || []) collectFiles(child, acc);
}

export type SymbolMatch = {
  file: string;
  line: number;
  snippet: string;
  kind: 'definition' | 'reference';
};

const DEF_PATTERNS = [
  // Generic: name followed by ( for function decl-ish
  (sym: string) => new RegExp(`\\b(function|fn|def|func|sub)\\s+${escapeRe(sym)}\\b`),
  // class / type / struct / interface
  (sym: string) => new RegExp(`\\b(class|struct|interface|trait|type|enum|impl)\\s+${escapeRe(sym)}\\b`),
  // const / let / var / val NAME
  (sym: string) => new RegExp(`\\b(const|let|var|val)\\s+${escapeRe(sym)}\\b`),
  // export ... NAME
  (sym: string) => new RegExp(`\\bexport\\s+(default\\s+)?(class|function|const|let|var|type|interface)?\\s*${escapeRe(sym)}\\b`),
  // Go-style: NAME func / type NAME
  (sym: string) => new RegExp(`\\bfunc\\s+(\\([^)]*\\)\\s+)?${escapeRe(sym)}\\b`),
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findSymbol(
  rootPath: string,
  symbol: string,
  maxResults = 10
): SymbolMatch[] {
  if (!symbol || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(symbol)) return [];

  const tree = buildTree(rootPath);
  const files: string[] = [];
  collectFiles(tree, files);

  const defRegexes = DEF_PATTERNS.map((p) => p(symbol));
  const refRegex = new RegExp(`\\b${escapeRe(symbol)}\\b`);

  const definitions: SymbolMatch[] = [];
  const references: SymbolMatch[] = [];

  for (const relPath of files) {
    if (definitions.length >= maxResults) break;
    const abs = path.join(rootPath, relPath);
    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }
    if (content.length > 500_000) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (defRegexes.some((re) => re.test(line))) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 8);
        definitions.push({
          file: relPath,
          line: i + 1,
          snippet: lines.slice(start, end).join('\n'),
          kind: 'definition',
        });
        if (definitions.length >= maxResults) break;
      } else if (references.length < maxResults && refRegex.test(line)) {
        references.push({
          file: relPath,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
          kind: 'reference',
        });
      }
    }
  }

  return [...definitions, ...references.slice(0, Math.max(0, maxResults - definitions.length))];
}

export function grepRepo(
  rootPath: string,
  query: string,
  maxResults = 100
): SymbolMatch[] {
  if (!query) return [];
  const tree = buildTree(rootPath);
  const files: string[] = [];
  collectFiles(tree, files);
  // Also include other text-like files
  const collectAll = (node: TreeNode) => {
    if (node.type === 'file') files.push(node.path);
    else for (const c of node.children || []) collectAll(c);
  };
  files.length = 0;
  collectAll(tree);

  const results: SymbolMatch[] = [];
  const re = new RegExp(escapeRe(query), 'i');
  for (const relPath of files) {
    if (results.length >= maxResults) break;
    const abs = path.join(rootPath, relPath);
    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }
    if (content.length > 500_000) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        results.push({
          file: relPath,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 200),
          kind: 'reference',
        });
        if (results.length >= maxResults) break;
      }
    }
  }
  return results;
}
