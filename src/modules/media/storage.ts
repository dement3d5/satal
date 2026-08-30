import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {getServerEnvironment} from '@/config/env';
import {AppError, ExternalServiceUnavailableError} from '@/server/errors/app-error';

export interface QuarantineStorage {
  put(objectKey: string, bytes: Uint8Array): Promise<void>;
}

class LocalQuarantineStorage implements QuarantineStorage {
  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    const root = path.resolve(process.cwd(), '.data', 'media', 'quarantine');
    const target = path.resolve(root, objectKey);
    if (!target.startsWith(`${root}${path.sep}`)) {
      throw new AppError('BAD_REQUEST', 'Invalid media object key', 400);
    }
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes, {flag: 'wx'});
  }
}

class DisabledR2Storage implements QuarantineStorage {
  put(): Promise<void> {
    throw new ExternalServiceUnavailableError('R2 object storage');
  }
}

export function getQuarantineStorage(): QuarantineStorage {
  return getServerEnvironment().OBJECT_STORAGE_PROVIDER === 'local'
    ? new LocalQuarantineStorage()
    : new DisabledR2Storage();
}
