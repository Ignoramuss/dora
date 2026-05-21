import { config } from './config';
import { createApp } from './app';

const app = createApp();

app.listen(config.port, () => {
  console.log(`CodeLens backend listening on http://localhost:${config.port}`);
  if (!config.anthropicApiKey) {
    console.warn('[warn] ANTHROPIC_API_KEY not set — AI routes will return 500.');
  }
});
