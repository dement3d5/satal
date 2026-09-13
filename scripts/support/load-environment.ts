import {existsSync} from 'node:fs';
import path from 'node:path';

export function loadLocalEnvironment(): void {
  for (const filename of ['.env.local', '.env']) {
    const candidate = path.resolve(process.cwd(), filename);
    if (existsSync(candidate)) process.loadEnvFile(candidate);
  }
}
