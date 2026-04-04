import path from 'node:path';
import fs from 'node:fs/promises';
import type { StorageProvider } from './provider';

export class LocalStorage implements StorageProvider {
  constructor(private readonly basePath: string) {}

  async save(category: string, filename: string, data: Buffer | Uint8Array): Promise<string> {
    const dir = path.join(this.basePath, category);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await Bun.write(filePath, data);
    return path.join(category, filename);
  }

  async read(filePath: string): Promise<Buffer | null> {
    const fullPath = path.join(this.basePath, filePath);
    const file = Bun.file(fullPath);
    const exists = await file.exists();
    if (!exists) return null;
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.unlink(fullPath).catch(() => {
      // Ignore if file doesn't exist
    });
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    return Bun.file(fullPath).exists();
  }

  getUrl(filePath: string): string {
    return `/api/uploads/${filePath}`;
  }
}
