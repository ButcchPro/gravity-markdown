import { invoke } from '@tauri-apps/api/core';

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

/** Human-readable text for logs — keeps the internal code for diagnosis. */
export function formatIpcError(e: unknown): string {
  const { code, message } = ipcErrorPayload(e);
  return code === 'UNKNOWN' ? message : `${code}: ${message}`;
}

/** Plain-language explanations for the structured FS_* codes. */
const FRIENDLY_ERRORS: Record<string, string> = {
  FS_NOT_FOUND: 'the file no longer exists',
  FS_ACCESS_DENIED: 'the system denied access to this file',
  FS_INVALID_DATA: 'the file is not readable UTF-8 text',
  FS_TOO_LARGE: 'the file is larger than the 32 MB limit',
  FS_UNSUPPORTED_EXTENSION: 'this file type is not supported here',
  FS_PATH_TRAVERSAL: 'the path is not allowed',
  FS_INVALID_BINARY: 'the document could not be encoded for saving',
  FS_IO_ERROR: 'the system reported an input/output error',
};

/**
 * User-facing error sentence: what failed is supplied by the caller, this
 * returns the plain-language reason. Internal codes stay in logs, not in the
 * toast (audit: users were reading `FS_ACCESS_DENIED` as the message).
 */
export function describeIpcError(e: unknown): string {
  const { code, message } = ipcErrorPayload(e);
  return FRIENDLY_ERRORS[code] ?? message ?? 'unknown error';
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
