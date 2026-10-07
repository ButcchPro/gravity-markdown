import { invoke } from '@tauri-apps/api/core';

export interface IpcReadFileParams {
  path: string;
}

export interface IpcWriteFileParams {
  path: string;
  content: string;
}

export interface IpcWriteBinaryParams {
  path: string;
  data: string;
}

/** Structured payload returned by the Rust commands (serde AppError). */
export interface AppErrorPayload {
  code: string;
  message: string;
}

/** Normalizes anything thrown across IPC into an {code, message} payload. */
export function ipcErrorPayload(e: unknown): AppErrorPayload {
  if (typeof e === 'object' && e !== null && 'code' in e && 'message' in e) {
    const payload = e as Partial<AppErrorPayload>;
    if (typeof payload.code === 'string' && typeof payload.message === 'string') {
      return { code: payload.code, message: payload.message };
    }
  }
  return {
    code: 'UNKNOWN',
    message: e instanceof Error ? e.message : String(e),
  };
}

/** Human-readable text for toasts/logs. */
export function formatIpcError(e: unknown): string {
  const { code, message } = ipcErrorPayload(e);
  return code === 'UNKNOWN' ? message : `${code}: ${message}`;
}

export function invokeReadFileContent(path: string): Promise<string> {
  return invoke<string>('read_file_content', { path });
}

export function invokeWriteFileContent(path: string, content: string): Promise<void> {
  return invoke<void>('write_file_content', { path, content });
}

export function invokeWriteFileBinary(path: string, data: string): Promise<void> {
  return invoke<void>('write_file_binary', { path, data });
}

export function invokeGetInitialFile(): Promise<string | null> {
  return invoke<string | null>('get_initial_file');
}
