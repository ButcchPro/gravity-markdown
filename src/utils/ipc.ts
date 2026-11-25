import { readTextFile, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { ipcErrorPayload, invokeReadFileContent, invokeWriteFileContent, invokeWriteFileBinary } from '../types/ipc';

/**
 * Access-error discrimination.
 *
 * Primary: structured codes returned by our Rust commands (AppError).
 * Legacy fallback: substring matching for plugin-fs errors, which are not
 * structured — kept until the plugin itself exposes stable error codes.
 */
export function isAccessError(e: unknown): boolean {
  const { code, message } = ipcErrorPayload(e);
  if (code === 'FS_ACCESS_DENIED') return true;
  if (code !== 'UNKNOWN' && code !== 'FS_IO_ERROR') return false;
  return /permission|denied|access|eacces|eperm/.test(message.toLowerCase());
}

/** Filesystem collaborators, injected so the fallback paths are testable. */
export interface FsAdapter {
  /** plugin-fs read (scoped path watcher). */
  readTextFile: (path: string) => Promise<string>;
  /** plugin-fs write. */
  writeTextFile: (path: string, content: string) => Promise<void>;
  /** plugin-fs binary write. */
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  /** Rust command: read any allowed text file. */
  invokeRead: (path: string) => Promise<string>;
  /** Rust command: write markdown text through the whitelisted path. */
  invokeWrite: (path: string, content: string) => Promise<void>;
  /** Rust command: write binary (base64) through the whitelisted path. */
  invokeWriteBinary: (path: string, base64: string) => Promise<void>;
}

const defaultAdapter: FsAdapter = {
  readTextFile: (path) => readTextFile(path),
  writeTextFile: (path, content) => writeTextFile(path, content),
  writeFile: (path, data) => writeFile(path, data),
  invokeRead: invokeReadFileContent,
  invokeWrite: invokeWriteFileContent,
  invokeWriteBinary: invokeWriteFileBinary,
};

export async function safeReadTextFile(
  path: string,
  adapter: FsAdapter = defaultAdapter,
): Promise<string> {
  try {
    return await adapter.readTextFile(path);
  } catch (e) {
    if (isAccessError(e)) {
      return adapter.invokeRead(path);
    }
    throw e;
  }
}

export async function safeWriteTextFile(
  path: string,
  content: string,
  adapter: FsAdapter = defaultAdapter,
): Promise<void> {
  try {
    await adapter.writeTextFile(path, content);
  } catch (e) {
    if (isAccessError(e)) {
      return adapter.invokeWrite(path, content);
    }
    throw e;
  }
}

/** Encodes bytes as base64 in 8 KB chunks (avoids call-stack limits). */
export function bytesToBase64(data: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let ci = 0; ci < data.length; ci += chunkSize) {
    const chunk = data.subarray(ci, Math.min(ci + chunkSize, data.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function safeWriteBinaryFile(
  path: string,
  data: Uint8Array,
  adapter: FsAdapter = defaultAdapter,
): Promise<void> {
  try {
    await adapter.writeFile(path, data);
  } catch (e) {
    if (!isAccessError(e)) {
      throw e;
    }
    return adapter.invokeWriteBinary(path, bytesToBase64(data));
  }
}
