import { readTextFile, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { invokeReadFileContent, invokeWriteFileContent, invokeWriteFileBinary } from '../types/ipc';

function isPermissionError(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return msg.includes('permission') || msg.includes('eacces') || msg.includes('access');
  }
  return false;
}

export async function safeReadTextFile(path: string): Promise<string> {
  try {
    return await readTextFile(path);
  } catch (e) {
    if (isPermissionError(e)) {
      return invokeReadFileContent(path);
    }
    throw e;
  }
}

export async function safeWriteTextFile(path: string, content: string): Promise<void> {
  try {
    await writeTextFile(path, content);
  } catch (e) {
    if (isPermissionError(e)) {
      return invokeWriteFileContent(path, content);
    }
    throw e;
  }
}

export async function safeWriteBinaryFile(path: string, data: Uint8Array): Promise<void> {
  try {
    await writeFile(path, data);
  } catch (e) {
    if (isPermissionError(e)) {
      let binary = '';
      const chunkSize = 8192;
      for (let ci = 0; ci < data.length; ci += chunkSize) {
        const chunk = data.subarray(ci, Math.min(ci + chunkSize, data.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      return invokeWriteFileBinary(path, base64);
    }
    throw e;
  }
}
