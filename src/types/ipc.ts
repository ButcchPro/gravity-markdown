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
