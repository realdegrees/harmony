export interface StorageProvider {
  save(category: string, filename: string, data: Buffer | Uint8Array): Promise<string>; // returns path
  read(path: string): Promise<Buffer | null>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getUrl(path: string): string; // returns public URL path for the file
}
