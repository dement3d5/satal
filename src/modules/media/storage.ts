import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {getServerEnvironment} from '@/config/env';
import {AppError, ExternalServiceUnavailableError} from '@/server/errors/app-error';

export interface QuarantineStorage {
  put(objectKey: string, bytes: Uint8Array): Promise<void>;
}

export interface MediaProcessingStorage extends QuarantineStorage {
  readQuarantine(objectKey: string): Promise<Uint8Array>;
  deleteQuarantine(objectKey: string): Promise<void>;
  putVariant(objectKey: string, bytes: Uint8Array): Promise<void>;
  readVariant(objectKey: string): Promise<Uint8Array>;
}

class LocalMediaStorage implements MediaProcessingStorage {
  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    const target = resolveObjectPath('quarantine', objectKey);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes, {flag: 'wx'});
  }

  async readQuarantine(objectKey: string): Promise<Uint8Array> {
    return readFile(resolveObjectPath('quarantine', objectKey));
  }

  async deleteQuarantine(objectKey: string): Promise<void> {
    await rm(resolveObjectPath('quarantine', objectKey), {force: true});
  }

  async putVariant(objectKey: string, bytes: Uint8Array): Promise<void> {
    const target = resolveObjectPath('variants', objectKey);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes);
  }

  async readVariant(objectKey: string): Promise<Uint8Array> {
    return readFile(resolveObjectPath('variants', objectKey));
  }
}

class DisabledR2Storage implements MediaProcessingStorage {
  put(): Promise<void> {
    throw new ExternalServiceUnavailableError('R2 object storage');
  }
  readQuarantine(): Promise<Uint8Array> {
    throw new ExternalServiceUnavailableError('R2 object storage');
  }
  deleteQuarantine(): Promise<void> {
    throw new ExternalServiceUnavailableError('R2 object storage');
  }
  putVariant(): Promise<void> {
    throw new ExternalServiceUnavailableError('R2 object storage');
  }
  readVariant(): Promise<Uint8Array> {
    throw new ExternalServiceUnavailableError('R2 object storage');
  }
}

export function getMediaStorage(): MediaProcessingStorage {
  return getServerEnvironment().OBJECT_STORAGE_PROVIDER === 'local'
    ? new LocalMediaStorage()
    : new DisabledR2Storage();
}

export function getQuarantineStorage(): QuarantineStorage {
  return getMediaStorage();
}

function resolveObjectPath(area: 'quarantine' | 'variants', objectKey: string): string {
  const root = path.resolve(process.cwd(), '.data', 'media', area);
  const target = path.resolve(root, objectKey);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new AppError('BAD_REQUEST', 'Invalid media object key', 400);
  }
  return target;
}
