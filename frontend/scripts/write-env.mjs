import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const outputPath = path.join(frontendRoot, 'src/environments/environment.generated.ts');
const apiBaseUrl = (process.env.API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

const fileContents = `export const environment = {
  apiBaseUrl: '${apiBaseUrl}'
} as const;
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, fileContents, 'utf8');

console.log(`Environment generated with API_BASE_URL=${apiBaseUrl}`);
