/**
 * Shared TypeScript interfaces for the Minecraft Launcher
 * These types are used by both the renderer and main processes
 */

export interface VersionInfo {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'historic';
  time: string;
  releaseTime: string;
  url: string;
}

export interface VersionDetails {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'historic';
  time: string;
  releaseTime: string;
  mainClass: string;
  assets: string;
  libraries: Library[];
  downloads: VersionDownloads;
}

export interface VersionDownloads {
  artifact?: DownloadInfo;
  clientside?: DownloadInfo;
  server?: DownloadInfo;
  classifiers?: {
    'natives-linux': DownloadInfo;
    'natives-windows': DownloadInfo;
    'natives-osx': DownloadInfo;
  };
}

export interface Library {
  name: string;
  downloads?: Downloads;
  rules?: Rule[];
  natives?: {
    linux?: string;
    windows?: string;
    osx?: string;
  };
  // For Minecraft 1.17+ style libraries with classifiers
  [key: string]: any; // Allow additional properties needed for native library detection
}

export interface Rule {
  action: 'allow' | 'disallow';
  os?: { name: 'windows' | 'osx' | 'linux'; version?: string };
  features?: { in_game?: boolean; has_demo?: boolean; is_rockstar?: boolean };
}

export interface Downloads {
  artifact?: DownloadInfo;
  classifiers?: {
    'natives-linux'?: DownloadInfo;
    'natives-windows'?: DownloadInfo;
    'natives-osx'?: DownloadInfo;
    'natives-windows-x86'?: DownloadInfo;
    'natives-windows-x86_64'?: DownloadInfo;
    'natives-windows-arm64'?: DownloadInfo;
    'natives-linux-x86_64'?: DownloadInfo;
    'natives-linux-aarch_64'?: DownloadInfo;
    'natives-macos'?: DownloadInfo;
    'natives-macos-aarch_64'?: DownloadInfo;
    'natives-macos-arm64'?: DownloadInfo;
  };
  [key: string]: any; // Allow additional properties
}

export interface DownloadInfo {
  url: string;
  sha1: string;
  size: number;
}

export interface VersionManifest {
  latestRelease: string;
  versions: Array<{
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
  }>;
}

export interface ProgressUpdate {
  type: 'progress' | 'status' | 'error' | 'complete';
  message: string;
  percent?: number;
}

export interface LaunchResult {
  success: boolean;
  message: string;
  errorCode?: string;
  javaPath?: string;
  gameDir?: string;
}

export interface LaunchConfig {
  version: string;
  nickname: string;
  javaPath?: string;
  gameDir?: string;
}

export interface JavaInfo {
  path: string;
  version: string;
  valid: boolean;
}

export interface DownloadStatus {
  url: string;
  totalSize: number;
  downloadedSize: number;
  filePath: string;
  speed?: number;
}

export interface DownloadVersionResult {
  success: boolean;
  message: string;
  version?: string;
  errorCode?: string;
  downloadedFiles?: string[];
}

export interface CheckVersionResult {
  installed: boolean;
  version?: string;
  reason?: string;
}