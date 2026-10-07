import { readTextFile, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { ipcErrorPayload, invokeReadFileContent, invokeWriteFileContent, invokeWriteFileBinary } from '../types/ipc';

/**
 * Access-error discrimination.
 *
 * Primary: structured codes returned by our Rust commands (AppError).
 * Legacy fallback: substring matching for plugin-fs errors, which are not
 * structured — kept until the plugin itself exposes stable error codes.
 */
function isAccessError(e: unknown): boolean {
  const { code, message } = ipcErrorPayload(e);
  if (code === 'FS_ACCESS_DENIED') return true;
  if (code !== 'UNKNOWN' && code !== 'FS_IO_ERROR') return false;
  return /permission|denied|access|eacces|eperm/.test(message.toLowerCase());
}

export async function safeReadTextFile(path: string): Promise<string> {
  try {
    return await readTextFile(path);
  } catch (e) {
    if (isAccessError(e)) {
      return invokeReadFileContent(path);
    }
    throw e;
  }
}

export async function safeWriteTextFile(path: string, content: string): Promise<void> {
  try {
    await writeTextFile(path, content);
  } catch (e) {
    if (isAccessError(e)) {
      return invokeWriteFileContent(path, content);
    }
    throw e;
  }
}

export async function safeWriteBinaryFile(path: string, data: Uint8Array): Promise<void> {
  try {
    await writeFile(path, data);
  } catch (e) {
    if (!isAccessError(e)) {
      throw e;
    }
    let binary = '';
    const chunkSize = 8192;
    for (let ci = 0; ci < data.length; ci += chunkSize) {
      const chunk = data.subarray(ci, Math.min(ci + chunkSize, data.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);
    return invokeWriteFileBinary(path, base64);
  }
}
