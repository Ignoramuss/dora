import { createHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

const COMMON_LANGS: BundledLanguage[] = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'bash',
  'shellscript',
  'markdown',
  'yaml',
  'toml',
  'html',
  'css',
  'sql',
];

const EXTRA_LANGS: Record<string, BundledLanguage> = {
  zig: 'zig' as BundledLanguage,
  haskell: 'haskell' as BundledLanguage,
  swift: 'swift' as BundledLanguage,
  kotlin: 'kotlin' as BundledLanguage,
  scala: 'scala' as BundledLanguage,
  elixir: 'elixir' as BundledLanguage,
  lua: 'lua' as BundledLanguage,
  dart: 'dart' as BundledLanguage,
  ocaml: 'ocaml' as BundledLanguage,
  nim: 'nim' as BundledLanguage,
  julia: 'julia' as BundledLanguage,
  protobuf: 'proto' as BundledLanguage,
  graphql: 'graphql' as BundledLanguage,
  vue: 'vue' as BundledLanguage,
  svelte: 'svelte' as BundledLanguage,
  dockerfile: 'docker' as BundledLanguage,
  makefile: 'make' as BundledLanguage,
  scss: 'scss' as BundledLanguage,
  xml: 'xml' as BundledLanguage,
  r: 'r' as BundledLanguage,
  fsharp: 'fsharp' as BundledLanguage,
  clojure: 'clojure' as BundledLanguage,
  erlang: 'erlang' as BundledLanguage,
  fish: 'fish' as BundledLanguage,
  powershell: 'powershell' as BundledLanguage,
  mdx: 'mdx' as BundledLanguage,
};

export const AVAILABLE_THEMES: BundledTheme[] = [
  'github-dark',
  'github-light',
  'one-dark-pro',
  'monokai',
];

export async function getHighlighter(theme: BundledTheme): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: AVAILABLE_THEMES,
      langs: COMMON_LANGS,
    }).then((hl) => {
      for (const l of COMMON_LANGS) loadedLangs.add(String(l));
      return hl;
    });
  }
  const hl = await highlighterPromise;
  if (!hl.getLoadedThemes().includes(theme)) {
    await hl.loadTheme(theme);
  }
  return hl;
}

export async function ensureLang(lang: string): Promise<string> {
  const hl = await getHighlighter('github-dark');
  if (loadedLangs.has(lang)) return lang;
  if ((COMMON_LANGS as readonly string[]).includes(lang)) {
    loadedLangs.add(lang);
    return lang;
  }
  const target = EXTRA_LANGS[lang];
  if (!target) return 'text';
  try {
    await hl.loadLanguage(target);
    loadedLangs.add(String(target));
    return String(target);
  } catch {
    return 'text';
  }
}

export async function highlightCode(code: string, lang: string, theme: BundledTheme): Promise<string> {
  const hl = await getHighlighter(theme);
  const resolvedLang = await ensureLang(lang);
  try {
    return hl.codeToHtml(code, { lang: resolvedLang, theme });
  } catch {
    return hl.codeToHtml(code, { lang: 'text', theme });
  }
}

export async function highlightToLines(
  code: string,
  lang: string,
  theme: BundledTheme
): Promise<string[]> {
  const hl = await getHighlighter(theme);
  const resolvedLang = await ensureLang(lang);
  try {
    const tokens = hl.codeToTokens(code, { lang: resolvedLang as BundledLanguage, theme });
    return tokens.tokens.map((lineTokens) =>
      lineTokens
        .map(
          (t) =>
            `<span style="color:${t.color || 'inherit'}">${escapeHtml(t.content)}</span>`
        )
        .join('')
    );
  } catch {
    return code.split('\n').map((l) => escapeHtml(l));
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
