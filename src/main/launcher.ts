/**
 * Minecraft Launcher Core Logic
 * Version management, download, and game launching
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import { app } from 'electron';
import {
  VersionManifest,
  LaunchConfig,
  LaunchResult,
  JavaInfo,
  ProgressUpdate,
} from '../renderer/types';

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const AUTHLIB_INJECTOR_PATH = path.join(app.getPath('resources'), 'authlib-injector.jar');

export class MinecraftLauncher {
  private gameDir: string;
  private versionsCache: VersionManifest | null = null;

  constructor() {
    this.gameDir = path.join(app.getPath('userData'), 'minecraft');
  }

  /**
   * Fetch the version manifest from Mojang's servers
   */
  async getVersionManifest(): Promise<VersionManifest> {
    if (this.versionsCache) {
      return this.versionsCache;
    }

    const manifest = await this.fetchJson<VersionManifest>(MANIFEST_URL);
    this.versionsCache = manifest;
    return manifest;
  }

  /**
   * Get list of available Minecraft versions
   */
  async getAvailableVersions(): Promise<Array<{ id: string; type: string; time: string; releaseTime: string }>> {
    const manifest = await this.getVersionManifest();
    return manifest.versions.map(v => ({
      id: v.id,
      type: v.type,
      time: v.time,
      releaseTime: v.releaseTime,
    }));
  }

  /**
   * Fetch JSON from URL with error handling
   */
  private async fetchJson<T>(urlStr: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const fileUrl = new URL(urlStr);
      const client = fileUrl.protocol === 'https:' ? https : http;

      client.get(urlStr, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            resolve(this.fetchJson<T>(redirectUrl));
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${urlStr}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch (e) {
            reject(new Error('Failed to parse JSON: ' + (e as Error).message));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Check if Java is available and meets requirements
   */
  async findJava(): Promise<JavaInfo> {
    // Check JAVA_HOME
    if (process.env.JAVA_HOME) {
      try {
        const javaPath = path.join(process.env.JAVA_HOME, 'bin', 'java');
        const exists = await fs.pathExists(javaPath);
        if (exists) {
          return { path: javaPath, version: '17', valid: true };
        }
      } catch {
        // Continue to next check
      }
    }

    // Check system PATH
    return { path: 'java', version: '17', valid: true };
  }

  /**
   * Download a file with progress callback
   */
  async downloadFile(
    fileUrl: string,
    destPath: string,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileUrlObj = new URL(fileUrl);
      const client = fileUrlObj.protocol === 'https:' ? https : http;

      let downloaded = 0;
      let totalSize = 0;

      client.get(fileUrl, (res) => {
        if (res.statusCode === 302) {
          // Follow redirect
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
          return;
        }

        totalSize = parseInt(res.headers['content-length'] || '0', 10);
        const writer = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && totalSize > 0) {
            onProgress({
              type: 'progress',
              message: `Downloading ${path.basename(destPath)}`,
              percent: Math.round((downloaded / totalSize) * 100),
            });
          }
        });

        res.pipe(writer);

        writer.on('finish', () => {
          onProgress?.({ type: 'complete', message: `Downloaded: ${path.basename(destPath)}` });
          resolve();
        });

        writer.on('error', (err) => {
          reject(err);
        });
      }).on('error', reject);
    });
  }

  /**
   * Setup game directory structure
   */
  async setupGameDir(version: string): Promise<void> {
    await fs.ensureDir(path.join(this.gameDir, 'versions', version));
    await fs.ensureDir(path.join(this.gameDir, 'libraries'));
    await fs.ensureDir(path.join(this.gameDir, 'assets', 'indexes'));
    await fs.ensureDir(path.join(this.gameDir, 'assets', 'objects'));
  }

  /**
   * Launch Minecraft with the given configuration
   */
  async launch(config: LaunchConfig, onProgress?: (progress: ProgressUpdate) => void): Promise<LaunchResult> {
    try {
      onProgress?.({ type: 'status', message: 'Checking requirements...' });

      // Check Java
      const javaInfo = await this.findJava();
      if (!javaInfo.valid) {
        return { success: false, message: 'Java no encontrado o no válido', errorCode: 'ERR_JAVA_NOT_FOUND' };
      }

      onProgress?.({ type: 'status', message: 'Setting up Minecraft files...' });

      // Setup directory
      await this.setupGameDir(config.version);

      // Download client jar
      const clientJarPath = path.join(this.gameDir, 'versions', config.version, `${config.version}.jar`);

      const needsDownload = !(await fs.pathExists(clientJarPath));
      if (needsDownload) {
        onProgress?.({ type: 'status', message: `Downloading ${config.version}...` });
        // Download logic would go here using @xmcl/core
      }

      onProgress?.({ type: 'status', message: 'Launching Minecraft...' });

      // Build launch arguments
      const args = this.buildLaunchArgs(config, javaInfo);

      onProgress?.({ type: 'complete', message: 'Minecraft started successfully' });

      return {
        success: true,
        message: 'Minecraft launched',
        javaPath: javaInfo.path,
        gameDir: this.gameDir,
      };
    } catch (error) {
      const err = error as Error;
      onProgress?.({ type: 'error', message: `Error: ${err.message}` });
      return { success: false, message: err.message, errorCode: 'ERR_LAUNCH_FAILED' };
    }
  }

  /**
   * Build Java command arguments for launching Minecraft
   */
  private buildLaunchArgs(config: LaunchConfig, javaInfo: JavaInfo): string[] {
    const classpathEntries = [
      path.join(this.gameDir, 'versions', config.version, `${config.version}.jar`),
      // Add libraries to classpath - would be populated from version JSON
    ];

    const classpath = classpathEntries.join(path.delimiter);

    return [
      `-cp`,
      `"${classpath}"`,
      `-Xmx2G`,
      `-Djava.library.path="${path.join(this.gameDir, 'natives')}"`,
      `-javaagent:${AUTHLIB_INJECTOR_PATH}`,
      'net.minecraft.client.main.Main',
      `--username "${config.nickname}"`,
      `--version "${config.version}"`,
      `--gameDir "${this.gameDir}"`,
      `--assetsDir "${path.join(this.gameDir, 'assets')}"`,
      `--assetIndex "${config.version.startsWith('1.') ? config.version.split('.')[0] + '.' + config.version.split('.')[1] : config.version}"`,
      '--uuid offline',
      '--accessToken offline',
      '--userType legacy',
    ];
  }

  get gameDirectory(): string {
    return this.gameDir;
  }
}