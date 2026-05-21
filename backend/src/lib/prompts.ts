export const EXPLAIN_SYSTEM = `You are a patient senior developer helping someone build a mental model of an unfamiliar codebase. Explain not just WHAT the code does, but WHY it's structured this way, what patterns or idioms are being used, and how it fits into the larger system.

Keep explanations concise but thorough. Use analogies to Java/Python concepts when helpful, since the user is comfortable with those languages. Format your response in markdown with headers, lists, and code blocks where appropriate.`;

export const SYNTAX_SYSTEM = `You are a programming language tutor. The user knows Java and Python well but may be learning a new language. Focus specifically on SYNTAX and SEMANTICS of the selected code:

- What does each keyword, operator, or symbol mean?
- What are the type annotations saying?
- How does this compare to equivalent Java/Python syntax?
- Are there any gotchas or surprising behaviors?

Be precise and structured. Use markdown.`;

export const TRACE_SYSTEM = `You are helping the user understand control flow in an unfamiliar codebase. Given a call site and (possibly) a definition, explain:

1. What the function/type does
2. How data flows from the call site into it
3. What it returns or how it modifies state
4. Any important side effects

If the definition cannot be found in the repo, say so and offer a best guess based on naming and context. Use markdown.`;

export const ARCHITECTURE_SYSTEM = `You are summarizing the architecture of a codebase to give a new contributor a fast on-ramp. Structure your response as markdown with these sections:

1. **Purpose** — what this project does in 1-2 sentences
2. **Entry points** — where execution begins
3. **Major modules** — the top-level directories and what they own
4. **Data flow** — how a typical request/operation moves through the system
5. **Key types & abstractions** — the most important named concepts
6. **Where to start reading** — 3-5 files that build the best mental model

Be specific. Reference file paths in backticks. Keep it punchy.`;

export function buildExplainUserMessage(args: {
  language: string;
  repoName: string;
  filePath: string;
  fileContent: string;
  readmeExcerpt: string;
  priorAnnotations: string;
  startLine: number;
  endLine: number;
  selectedCode: string;
}): string {
  const {
    language,
    repoName,
    filePath,
    fileContent,
    readmeExcerpt,
    priorAnnotations,
    startLine,
    endLine,
    selectedCode,
  } = args;
  return `Context:
- Repository: ${repoName}
- File: ${filePath}
- Language: ${language}

README excerpt:
${readmeExcerpt || '(no README found)'}

Prior annotations in this file:
${priorAnnotations || '(none yet)'}

Full file content:
\`\`\`${language}
${fileContent}
\`\`\`

The user selected lines ${startLine}–${endLine}:
\`\`\`${language}
${selectedCode}
\`\`\`

Explain this selection.`;
}

export function buildSyntaxUserMessage(args: {
  language: string;
  selectedCode: string;
}): string {
  return `Language: ${args.language}

Selected code:
\`\`\`${args.language}
${args.selectedCode}
\`\`\`

Walk through the syntax in detail.`;
}

export function buildTraceUserMessage(args: {
  language: string;
  symbol: string;
  callFile: string;
  callLine: number;
  callContext: string;
  definitions: { file: string; line: number; snippet: string }[];
}): string {
  const defsText = args.definitions.length
    ? args.definitions
        .map(
          (d) =>
            `Possible definition at \`${d.file}:${d.line}\`:\n\`\`\`${args.language}\n${d.snippet}\n\`\`\``
        )
        .join('\n\n')
    : '(No definition was found by static search across the repo.)';
  return `Symbol: \`${args.symbol}\`
Language: ${args.language}

Call site at \`${args.callFile}:${args.callLine}\`:
\`\`\`${args.language}
${args.callContext}
\`\`\`

${defsText}

Explain how this call flows.`;
}

export function buildArchitectureUserMessage(args: {
  repoName: string;
  scopePath: string;
  fileTreeText: string;
  keyFiles: { path: string; content: string }[];
}): string {
  const keyFilesText = args.keyFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');
  return `Repository: ${args.repoName}
Scope: ${args.scopePath || '(entire repo)'}

File tree (truncated):
\`\`\`
${args.fileTreeText}
\`\`\`

Key files:
${keyFilesText}

Generate the architecture overview.`;
}
