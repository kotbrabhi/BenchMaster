import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const outputPath = path.join(frontendRoot, 'src/environments/environment.generated.ts');
const apiBaseUrl = (process.env.API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

if (process.env.E2E === '1') {
  let parsedApiUrl;
  try {
    parsedApiUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error('E2E requires API_BASE_URL to be a localhost URL.');
  }

  if (!['localhost', '127.0.0.1'].includes(parsedApiUrl.hostname)) {
    throw new Error('E2E refuses to build with a non-local API_BASE_URL.');
  }
}

const fileContents = `export const environment = {
  apiBaseUrl: '${apiBaseUrl}'
} as const;
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, fileContents, 'utf8');

console.log(`Environment generated (E2E=${process.env.E2E === '1' ? 'enabled' : 'disabled'})`);
