/**
 * Minecraft Launcher Core Logic
 * Version management, download, and game launching
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { app, shell } from 'electron';
import {
  VersionManifest,
  LaunchConfig,
  LaunchResult,
  JavaInfo,
  ProgressUpdate,
} from '../renderer/types';

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

export class MinecraftLauncher {
  private gameDir: string;
  private versionsCache: VersionManifest | null = null;
  private currentProcess: ChildProcessWithoutNullStreams | null = null;

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
   * Check if Java is available and get actual version
   */
  async findJava(): Promise<JavaInfo> {
    // Try JAVA_HOME first
    if (process.env.JAVA_HOME) {
      const javaExe = process.platform === 'win32'
        ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe')
        : path.join(process.env.JAVA_HOME, 'bin', 'java');

      if (await fs.pathExists(javaExe)) {
        const version = await this.getJavaVersion(javaExe);
        if (version) {
          return { path: javaExe, version, valid: true };
        }
      }
    }

    // Check system PATH
    return new Promise((resolve) => {
      const javaProcess = spawn('java', ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      javaProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      javaProcess.on('close', (code) => {
        if (code === 0) {
          const version = this.parseJavaVersion(stderr) || '17';
          resolve({ path: 'java', version, valid: true });
        } else {
          resolve({ path: 'java', version: '', valid: false });
        }
      });

      javaProcess.on('error', () => {
        resolve({ path: 'java', version: '', valid: false });
      });
    });
  }

  /**
   * Get actual Java version by running java -version
   */
  private async getJavaVersion(javaPath: string): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(javaPath, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseJavaVersion(stderr) || null);
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => resolve(null));
    });
  }

  /**
   * Parse Java version from output
   */
  private parseJavaVersion(output: string): string | null {
    const match = output.match(/version ["'](\d+(?:\.\d+)*)/);
    return match ? match[1] : null;
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
      const client = fileUrl.startsWith('https') ? https : http;
      let downloaded = 0;
      let totalSize = 0;

      client.get(fileUrl, (res) => {
        if (res.statusCode === 302) {
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

        writer.on('error', (err: Error) => {
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
    await fs.ensureDir(path.join(this.gameDir, 'natives'));
  }

  /**
   * Build Java command arguments for launching Minecraft
   */
  private buildLaunchArgs(config: LaunchConfig): string[] {
    const clientJar = path.join(this.gameDir, 'versions', config.version, `${config.version}.jar`);

    // Build classpath from libraries directory
    const librariesPath = path.join(this.gameDir, 'libraries');
    let classpath = clientJar;

    // Add all JARs from libraries (simplified - in production would parse version JSON)
    try {
      if (fs.existsSync(librariesPath)) {
        const jars = this.findJarsInDir(librariesPath);
        classpath = [clientJar, ...jars].join(path.delimiter);
      }
    } catch {
      // Use basic classpath if libraries not found
    }

    const jarPath = path.join(this.gameDir, 'versions', config.version, `${config.version}.jar`);
    const libsPath = path.join(this.gameDir, 'libraries');
    const nativesPath = path.join(this.gameDir, 'natives');
    const assetsDir = path.join(this.gameDir, 'assets');
    const assetIndex = config.version.startsWith('1.')
      ? `${config.version.split('.')[0]}.${config.version.split('.')[1]}`
      : config.version;

    return [
      `-cp`,
      `"${classpath}"`,
      `-Xmx2G`,
      `-Djava.library.path="${nativesPath}"`,
      'net.minecraft.client.main.Main',
      `--username`,
      config.nickname,
      `--version`,
      config.version,
      `--gameDir`,
      this.gameDir,
      `--assetsDir`,
      assetsDir,
      `--assetIndex`,
      assetIndex,
      '--uuid',
      'offline',
      '--accessToken',
      'offline',
      '--userType',
      'legacy',
      '--offline', // Native offline mode
    ];
  }

  /**
   * Find all JAR files in directory (recursive)
   */
  private findJarsInDir(dir: string): string[] {
    const jars: string[] = [];
    if (!fs.existsSync(dir)) return jars;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        jars.push(...this.findJarsInDir(fullPath));
      } else if (item.name.endsWith('.jar') || item.name.endsWith('.zip')) {
        jars.push(fullPath);
      }
    }
    return jars;
  }

  /**
   * Launch Minecraft with the given configuration
   */
  async launch(
    config: LaunchConfig,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<LaunchResult> {
    try {
      onProgress?.({ type: 'status', message: 'Checking Java...' });

      // Check Java
      const javaInfo = await this.findJava();
      if (!javaInfo.valid || !javaInfo.path) {
        return { success: false, message: 'Java no encontrado. Instala Java 17 o superior.', errorCode: 'ERR_JAVA_NOT_FOUND' };
      }

      onProgress?.({ type: 'status', message: `Java ${javaInfo.version} encontrado` });

      // Check if client jar exists
      const clientJar = path.join(this.gameDir, 'versions', config.version, `${config.version}.jar`);
      const jarExists = await fs.pathExists(clientJar);

      if (!jarExists) {
        return {
          success: false,
          message: `Version ${config.version} no descargada. Descarga los archivos primero.`,
          errorCode: 'ERR_VERSION_NOT_DOWNLOADED',
        };
      }

      onProgress?.({ type: 'status', message: 'Lanzando Minecraft...' });

      // Setup directory structure
      await this.setupGameDir(config.version);

      // Build and execute Java process
      const args = this.buildLaunchArgs(config);
      const javaPath = javaInfo.path;

      this.currentProcess = spawn(javaPath, args.slice(1), {  // Remove first -cp or handle differently
        cwd: this.gameDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Forward output to progress callback
      this.currentProcess.stdout?.on('data', (data) => {
        onProgress?.({ type: 'status', message: data.toString().trim() });
      });

      this.currentProcess.stderr?.on('data', (data) => {
        onProgress?.({ type: 'status', message: data.toString().trim() });
      });

      this.currentProcess.on('error', (err: Error) => {
        onProgress?.({ type: 'error', message: `Error: ${err.message}` });
      });

      this.currentProcess.on('close', (code) => {
        onProgress?.({ type: 'complete', message: `Minecraft exited with code ${code}` });
        this.currentProcess = null;
      });

      return {
        success: true,
        message: `Minecraft lanzado con ${config.nickname}`,
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
   * Stop the current Minecraft process
   */
  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  get gameDirectory(): string {
    return this.gameDir;
  }
}