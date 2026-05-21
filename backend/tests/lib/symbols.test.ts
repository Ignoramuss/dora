import { describe, it, expect, afterEach } from 'vitest';
import { findSymbol, grepRepo } from '../../src/lib/symbols';
import { makeRepo, cleanupRepo } from '../helpers';

let dirs: string[] = [];
function tmpRepo(files: Record<string, string>): string {
  const d = makeRepo(files);
  dirs.push(d);
  return d;
}
afterEach(() => {
  dirs.splice(0).forEach(cleanupRepo);
});

describe('findSymbol', () => {
  it('finds a TypeScript function definition', () => {
    const dir = tmpRepo({
      'src/util.ts':
        'export function doTheThing(x: number) {\n  return x * 2;\n}\n',
      'src/main.ts': 'import { doTheThing } from "./util";\ndoTheThing(3);\n',
    });
    const matches = findSymbol(dir, 'doTheThing');
    const def = matches.find((m) => m.kind === 'definition');
    expect(def).toBeDefined();
    expect(def!.file).toBe('src/util.ts');
    expect(def!.line).toBe(1);
    expect(def!.snippet).toContain('function doTheThing');
  });

  it('finds a Go function definition with method receiver', () => {
    const dir = tmpRepo({
      'handler.go':
        'package main\n\nfunc (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {\n  doStuff()\n}\n',
      'main.go': 'package main\n\nfunc main() {\n  h.ServeHTTP(nil, nil)\n}\n',
    });
    const matches = findSymbol(dir, 'ServeHTTP');
    const def = matches.find((m) => m.kind === 'definition');
    expect(def).toBeDefined();
    expect(def!.file).toBe('handler.go');
  });

  it('finds class / type / struct definitions', () => {
    const dir = tmpRepo({
      'a.ts': 'export class Renderer {\n  draw() {}\n}\n',
      'b.go': 'type Renderer struct {\n  width int\n}\n',
      'c.rs': 'pub struct Other {}\n',
    });
    const matches = findSymbol(dir, 'Renderer');
    const defs = matches.filter((m) => m.kind === 'definition');
    expect(defs.length).toBeGreaterThanOrEqual(2);
    const files = defs.map((d) => d.file).sort();
    expect(files).toContain('a.ts');
    expect(files).toContain('b.go');
  });

  it('also surfaces references when there is no definition', () => {
    const dir = tmpRepo({
      'callsite.ts': 'thirdPartyApi.doStuff();\nthirdPartyApi.other();\n',
    });
    const matches = findSymbol(dir, 'thirdPartyApi');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.kind === 'reference')).toBe(true);
  });

  it('returns nothing for invalid identifiers (no shell injection of regex chars)', () => {
    const dir = tmpRepo({ 'a.ts': 'export {}\n' });
    expect(findSymbol(dir, '../etc')).toEqual([]);
    expect(findSymbol(dir, '.*')).toEqual([]);
    expect(findSymbol(dir, '')).toEqual([]);
  });
});

describe('grepRepo', () => {
  it('finds case-insensitive matches across files', () => {
    const dir = tmpRepo({
      'README.md': 'CodeLens Project',
      'src/a.ts': '// uses codelens internally\n',
      'src/b.ts': 'console.log("hello");\n',
    });
    const hits = grepRepo(dir, 'codelens');
    const files = new Set(hits.map((h) => h.file));
    expect(files.has('README.md')).toBe(true);
    expect(files.has('src/a.ts')).toBe(true);
    expect(files.has('src/b.ts')).toBe(false);
  });

  it('skips .gitignored files', () => {
    const dir = tmpRepo({
      '.gitignore': 'build/\n',
      'src/x.ts': 'NEEDLE here',
      'build/x.ts': 'NEEDLE there',
    });
    const hits = grepRepo(dir, 'NEEDLE');
    const files = hits.map((h) => h.file);
    expect(files).toContain('src/x.ts');
    expect(files).not.toContain('build/x.ts');
  });

  it('returns empty for empty query', () => {
    const dir = tmpRepo({ 'a.ts': 'anything' });
    expect(grepRepo(dir, '')).toEqual([]);
  });
});
