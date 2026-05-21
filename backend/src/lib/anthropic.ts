import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env to enable AI features.'
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export const MODEL = config.anthropicModel;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function callClaude(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 2048
): Promise<string> {
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  return text;
}
