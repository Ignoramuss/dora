import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { buildTree, safeJoin, detectLanguage, TreeNode } from '../../src/lib/tree';
import { makeRepo, cleanupRepo } from '../helpers';

let createdRepos: string[] = [];
function tmpRepo(files: Record<string, string>): string {
  const dir = makeRepo(files);
  createdRepos.push(dir);
  return dir;
}

afterEach(() => {
  createdRepos.splice(0).forEach(cleanupRepo);
});

function findNode(tree: TreeNode, relPath: string): TreeNode | null {
  if (tree.path === relPath) return tree;
  for (const child of tree.children || []) {
    const found = findNode(child, relPath);
    if (found) return found;
  }
  return null;
}

function listAllPaths(tree: TreeNode, acc: string[] = []): string[] {
  if (tree.path) acc.push(tree.path);
  for (const c of tree.children || []) listAllPaths(c, acc);
  return acc;
}

describe('buildTree', () => {
  it('lists files and directories with relative paths', () => {
    const dir = tmpRepo({
      'README.md': '# x',
      'src/index.ts': 'export {}',
      'src/lib/util.ts': 'export const x = 1',
    });
    const tree = buildTree(dir);
    expect(tree.type).toBe('dir');
    expect(findNode(tree, 'README.md')?.type).toBe('file');
    expect(findNode(tree, 'src/lib/util.ts')?.type).toBe('file');
  });

  it('sorts directories before files alphabetically within each level', () => {
    const dir = tmpRepo({
      'a.txt': 'x',
      'z.txt': 'x',
      'b/inner.txt': 'x',
      'aaa/inner.txt': 'x',
    });
    const tree = buildTree(dir);
    const names = (tree.children || []).map((c) => c.name);
    // dirs come first, alpha-sorted
    expect(names).toEqual(['aaa', 'b', 'a.txt', 'z.txt']);
  });

  it('respects .gitignore patterns by default', () => {
    const dir = tmpRepo({
      '.gitignore': 'secrets/\ngenerated.ts\n',
      'src/index.ts': 'export {}',
      'secrets/api-key.txt': 'TOPSECRET',
      'generated.ts': 'AUTO',
    });
    const tree = buildTree(dir);
    const paths = listAllPaths(tree);
    expect(paths).toContain('src/index.ts');
    expect(paths).not.toContain('secrets');
    expect(paths).not.toContain('secrets/api-key.txt');
    expect(paths).not.toContain('generated.ts');
  });

  it('hides node_modules, .git, lock files, and dotfiles by default', () => {
    const dir = tmpRepo({
      'index.ts': 'export {}',
      'node_modules/foo/index.js': 'm',
      '.git/HEAD': 'ref',
      '.env': 'SECRET=1',
      'package-lock.json': '{}',
      'yarn.lock': 'x',
    });
    const tree = buildTree(dir);
    const paths = listAllPaths(tree);
    expect(paths).toContain('index.ts');
    expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false);
    expect(paths.some((p) => p.startsWith('.git'))).toBe(false);
    expect(paths).not.toContain('.env');
    expect(paths).not.toContain('package-lock.json');
    expect(paths).not.toContain('yarn.lock');
  });

  it('includes hidden and ignored entries when showHidden=true', () => {
    const dir = tmpRepo({
      '.gitignore': 'build/\n',
      'index.ts': 'export {}',
      'build/out.js': '',
      '.dotfile': 'x',
    });
    const tree = buildTree(dir, { showHidden: true });
    const paths = listAllPaths(tree);
    expect(paths).toContain('build');
    expect(paths).toContain('build/out.js');
    expect(paths).toContain('.dotfile');
  });
});

describe('safeJoin', () => {
  it('joins a normal relative path inside root', () => {
    const got = safeJoin('/repo', 'src/index.ts');
    expect(got).toBe(path.resolve('/repo', 'src/index.ts'));
  });

  it('blocks parent-directory traversal', () => {
    expect(safeJoin('/repo', '../etc/passwd')).toBeNull();
    expect(safeJoin('/repo', 'src/../../etc/passwd')).toBeNull();
  });

  it('blocks absolute-path escapes', () => {
    expect(safeJoin('/repo', '/etc/passwd')).toBeNull();
  });

  it('allows root itself', () => {
    expect(safeJoin('/repo', '')).toBe(path.resolve('/repo'));
  });
});

describe('detectLanguage', () => {
  it('maps common extensions to Shiki language ids', () => {
    expect(detectLanguage('foo.ts')).toBe('typescript');
    expect(detectLanguage('foo.tsx')).toBe('tsx');
    expect(detectLanguage('foo.go')).toBe('go');
    expect(detectLanguage('foo.rs')).toBe('rust');
    expect(detectLanguage('foo.py')).toBe('python');
    expect(detectLanguage('foo.cpp')).toBe('cpp');
    expect(detectLanguage('foo.zig')).toBe('zig');
  });

  it('recognises Dockerfile and Makefile by basename', () => {
    expect(detectLanguage('path/to/Dockerfile')).toBe('dockerfile');
    expect(detectLanguage('repo/Makefile')).toBe('makefile');
  });

  it('falls back to text for unknown extensions', () => {
    expect(detectLanguage('foo.weirdext')).toBe('text');
    expect(detectLanguage('LICENSE')).toBe('text');
  });
});
