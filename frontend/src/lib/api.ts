export type Repo = {
  id: number;
  name: string;
  source_type: 'github' | 'local';
  source_url_or_path: string;
  branch: string | null;
  cloned_path: string;
  last_opened_at: string;
  created_at: string;
  annotation_count?: number;
};

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: TreeNode[];
};

export type FilePayload = {
  path: string;
  content: string;
  language: string;
  size: number;
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

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.detail || body.error || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export const api = {
  health: () => http<{ ok: boolean; aiConfigured: boolean; model: string }>('/api/health'),

  repos: {
    list: () => http<Repo[]>('/api/repos'),
    clone: (url: string, branch?: string) =>
      http<Repo>('/api/repos/clone', { method: 'POST', body: JSON.stringify({ url, branch }) }),
    addLocal: (path: string, name?: string) =>
      http<Repo>('/api/repos/local', { method: 'POST', body: JSON.stringify({ path, name }) }),
    pull: (id: number) =>
      http<{ ok: true }>(`/api/repos/${id}/pull`, { method: 'POST' }),
    remove: (id: number) =>
      http<{ ok: true }>(`/api/repos/${id}`, { method: 'DELETE' }),
    tree: (id: number, showHidden = false) =>
      http<TreeNode>(`/api/repos/${id}/tree?showHidden=${showHidden}`),
    file: (id: number, path: string) =>
      http<FilePayload>(`/api/repos/${id}/file?path=${encodeURIComponent(path)}`),
    search: (id: number, query: string) =>
      http<{ results: { file: string; line: number; snippet: string }[] }>(
        `/api/repos/${id}/search`,
        { method: 'POST', body: JSON.stringify({ query }) }
      ),
  },

  ai: {
    explain: (args: {
      repoId: number;
      filePath: string;
      startLine: number;
      endLine: number;
      selectedText: string;
    }) =>
      http<{ explanation: string }>('/api/ai/explain', {
        method: 'POST',
        body: JSON.stringify(args),
      }),
    syntax: (args: { filePath: string; selectedText: string }) =>
      http<{ explanation: string }>('/api/ai/syntax', {
        method: 'POST',
        body: JSON.stringify(args),
      }),
    trace: (args: {
      repoId: number;
      filePath: string;
      startLine: number;
      endLine: number;
      selectedText: string;
      symbol?: string;
    }) =>
      http<{
        explanation: string;
        symbol: string;
        definitions: { file: string; line: number; snippet: string; kind: string }[];
      }>('/api/ai/trace', {
        method: 'POST',
        body: JSON.stringify(args),
      }),
    architecture: (repoId: number, scopePath = '') =>
      http<{ summary: string }>('/api/ai/architecture', {
        method: 'POST',
        body: JSON.stringify({ repoId, scopePath }),
      }),
    followup: (annotationId: number, question: string) =>
      http<{ response: string }>('/api/ai/followup', {
        method: 'POST',
        body: JSON.stringify({ annotationId, question }),
      }),
  },

  annotations: {
    forRepo: (repoId: number) => http<Annotation[]>(`/api/annotations/repo/${repoId}`),
    forFile: (repoId: number, filePath: string) =>
      http<Annotation[]>(
        `/api/annotations/file?repoId=${repoId}&path=${encodeURIComponent(filePath)}`
      ),
    get: (id: number) =>
      http<{ annotation: Annotation; conversation: ConversationMessage[] }>(
        `/api/annotations/${id}`
      ),
    create: (data: Partial<Annotation> & {
      repoId: number;
      filePath: string;
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
      selectedText?: string;
      color?: string;
      userNote?: string;
      aiExplanation?: string;
      kind?: string;
    }) =>
      http<Annotation>('/api/annotations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: { color?: string; userNote?: string; aiExplanation?: string }
    ) =>
      http<Annotation>(`/api/annotations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      http<{ ok: true }>(`/api/annotations/${id}`, { method: 'DELETE' }),
  },

  journal: {
    list: (repoId: number) =>
      http<{ id: number; content_markdown: string; created_at: string; updated_at: string }[]>(
        `/api/journal/${repoId}`
      ),
    create: (repoId: number, content: string) =>
      http('/api/journal', {
        method: 'POST',
        body: JSON.stringify({ repoId, content }),
      }),
    update: (id: number, content: string) =>
      http(`/api/journal/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    remove: (id: number) => http(`/api/journal/${id}`, { method: 'DELETE' }),
  },

  progress: (repoId: number) =>
    http<{
      visits: { file_path: string; first_visited_at: string; last_visited_at: string }[];
      annotated: { file_path: string; count: number }[];
    }>(`/api/progress/${repoId}`),
};
