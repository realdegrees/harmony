import { LocalStorage } from './local';
import type { StorageProvider } from './provider';
import { env } from '../config/env';

let storage: StorageProvider;

export function getStorage(): StorageProvider {
  if (!storage) {
    storage = new LocalStorage(env.STORAGE_PATH);
  }
  return storage;
}
