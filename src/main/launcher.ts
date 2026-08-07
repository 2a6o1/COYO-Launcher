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

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest.json';

export class MinecraftLauncher {
  // Known working mirrors for old versions (Mojang hosts are deprecated)
  private static readonly VERSION_MIRRORS: Record<string, { client: string; assets: string }> = {
    '1.20.4': {
      client: 'https://maven.fabricmc.net/net/minecraft/client/1.20.4/client-1.20.4.jar',
      assets: 'https://maven.fabricmc.net/net/minecraft/client/1.20.4/client-1.20.4.jar',
    },
    '1.20.3': {
      client: 'https://maven.fabricmc.net/net/minecraft/client/1.20.3/client-1.20.3.jar',
      assets: 'https://maven.fabricmc.net/net/minecraft/client/1.20.3/client-1.20.3.jar',
    },
    '1.20.2': {
      client: 'https://maven.fabricmc.net/net/minecraft/client/1.20.2/client-1.20.2.jar',
      assets: 'https://maven.fabricmc.net/net/minecraft/client/1.20.2/client-1.20.2.jar',
    },
  };

  // Known libraries mirrors
  private static readonly LIBRARIES_MIRROR = 'https://maven.fabricmc.net';

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
        classpath = [...jars, clientJar].join(path.delimiter);
      }
    } catch {
      // Use basic classpath if libraries not found
    }

    const nativesPath = path.join(this.gameDir, 'natives');
    const assetsDir = path.join(this.gameDir, 'assets');
    const assetIndex = config.version.startsWith('1.')
      ? `${config.version.split('.')[0]}.${config.version.split('.')[1]}`
      : config.version;

    return [
      '-cp',
      classpath,
      '-Xmx2G',
      `-Djava.library.path="${nativesPath}"`,
      'net.minecraft.client.main.Main',
      '--username',
      config.nickname,
      '--version',
      config.version,
      '--gameDir',
      this.gameDir,
      '--assetsDir',
      assetsDir,
      '--assetIndex',
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

      this.currentProcess = spawn(javaPath, args, {
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

  /**
   * Get version details from Mojang's version manifest
   */
  async getVersionDetails(versionId: string): Promise<any> {
    const manifest = await this.getVersionManifest();
    const versionEntry = manifest.versions.find(v => v.id === versionId);

    if (!versionEntry) {
      throw new Error(`Version ${versionId} not found in manifest`);
    }

    const versionDetails = await this.fetchJson<any>(versionEntry.url);
    return versionDetails;
  }

  /**
   * Download a complete Minecraft version with libraries
   */
  async downloadVersion(
    version: string,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<{ success: boolean; message: string; errorCode?: string; downloadedFiles?: string[] }> {
    try {
      console.log(`[Download] Starting download for version ${version}`);
      onProgress?.({ type: 'status', message: `Obteniendo información de versión ${version}...` });

      // Get version details
      const versionDetails = await this.getVersionDetails(version);

      // Setup directories
      const versionDir = path.join(this.gameDir, 'versions', version);
      const librariesDir = path.join(this.gameDir, 'libraries');
      const assetsDir = path.join(this.gameDir, 'assets', 'indexes');

      await fs.ensureDir(versionDir);
      await fs.ensureDir(librariesDir);
      await fs.ensureDir(assetsDir);

      const downloadedFiles: string[] = [];
      let totalFiles = 0;
      let downloadedCount = 0;

      // Count total files (client jar + libraries)
      const libraries = versionDetails.libraries || [];
      totalFiles = 1 + libraries.length; // 1 for client jar

      // Help to build FabricMC library URL from library name
      const buildFabricLibUrl = (libName: string): string => {
        const parts = libName.split(':');
        if (parts.length >= 3) {
          const groupId = parts[0];
          const artifactId = parts[1];
          const libVersion = parts[2];
          const libPath = groupId.replace(/\./g, '/') + `/${artifactId}/${libVersion}/${artifactId}-${libVersion}.jar`;
          return `https://maven.fabricmc.net/${libPath}`;
        }
        return '';
      };

      // Download client jar - use mirror for old versions
      const clientJarPath = path.join(versionDir, `${version}.jar`);
      console.log(`[Download] Downloading client.jar (${version}.jar)`);
      onProgress?.({ type: 'progress', message: 'Descargando client.jar...', percent: 0 });

      // Get client URL - check VERSION_MIRRORS first for old versions
      const mirror = (MinecraftLauncher as any).VERSION_MIRRORS?.[version];
      const rawClientUrl = mirror?.client || versionDetails.downloads?.artifact?.url;

      // Try Mojang URL, fallback to FabricMC if needed
      let clientUrl = rawClientUrl;
      if (rawClientUrl) {
        try {
          const parsed = new URL(rawClientUrl);
          if (parsed.hostname.includes('.minecraft.net') || parsed.hostname.includes('mojang.com')) {
            // For piston-data.mojang.com, try Mojang first, will use FabricMC on failure
            console.log(`[Download] Using Mojang client URL: ${rawClientUrl}`);
          }
        } catch {
          console.log(`[Download] Using Mojang client URL: ${rawClientUrl}`);
        }
      }

      if (clientUrl) {
        try {
          await this.downloadFile(
            clientUrl,
            clientJarPath,
            (p) => {
              console.log(`[Download] client.jar: ${p.percent}%`);
              onProgress?.({ ...p, message: 'Descargando client.jar...' });
            }
          );
          downloadedFiles.push('client.jar');
          downloadedCount++;
          console.log(`[Download] OK client.jar`);
        } catch (e) {
          const errMsg = (e as Error).message;
          console.log(`[Download] FAIL client.jar: ${errMsg}`);
          // Try FabricMC mirror as fallback for Mojang hosts
          const versionMatch = clientUrl.match(/client-([\d.]+)\.jar$/);
          if (versionMatch) {
            const fabricClientUrl = `https://maven.fabricmc.net/net/minecraft/client/${versionMatch[1]}/client-${versionMatch[1]}.jar`;
            console.log(`[Download] Trying FabricMC fallback: ${fabricClientUrl}`);
            try {
              await this.downloadFile(
                fabricClientUrl,
                clientJarPath,
                (p) => {
                  console.log(`[Download] client.jar (FabricMC): ${p.percent}%`);
                  onProgress?.({ ...p, message: 'Descargando client.jar (mirror)...' });
                }
              );
              downloadedFiles.push('client.jar');
              downloadedCount++;
              console.log(`[Download] OK client.jar (from FabricMC)`);
            } catch (e2) {
              console.log(`[Download] FabricMC fallback also failed: ${(e2 as Error).message}`);
              throw e;
            }
          } else {
            throw e;
          }
        }
      }

      const percent = Math.round((downloadedCount / totalFiles) * 100);
      onProgress?.({
        type: 'progress',
        message: `Progreso: ${downloadedCount}/${totalFiles}`,
        percent
      });

      // Download libraries
      console.log(`[Download] Downloading ${libraries.length} libraries...`);

      for (const lib of libraries) {
        if (!lib.name || !lib.downloads?.artifact?.url) {
          console.log(`[Download] SKIP invalid lib entry`);
          continue;
        }

        // Parse library name (format: groupId:artifactId:version)
        const parts = lib.name.split(':');
        if (parts.length < 3) continue;

        const groupId = parts[0];
        const artifactId = parts[1];
        const libVersion = parts[2];

        // Try Mojang URL first, build FabricMC fallback
        let downloadUrl = lib.downloads.artifact.url;
        try {
          new URL(downloadUrl);
        } catch {
          console.log(`[Download] SKIP invalid URL`);
          continue;
        }
        try {
          new URL(downloadUrl);
        } catch {
          console.log(`[Download] SKIP invalid URL`);
          continue;
        }

        // Create library directory structure
        const libDirParts = groupId.split('.');
        const libDir = path.join(librariesDir, ...libDirParts, artifactId, libVersion);
        await fs.ensureDir(libDir);

        const libJarName = `${artifactId}-${libVersion}.jar`;
        const libJarPath = path.join(libDir, libJarName);

        // Check if library already exists with same size
        let needsDownload = true;
        try {
          const existingStats = await fs.stat(libJarPath);
          if (existingStats.size === lib.downloads?.artifact?.size) {
            needsDownload = false;
            console.log(`[Download] SKIP ${libJarName} (exists)`);
          }
        } catch {
          needsDownload = true;
        }

        if (needsDownload) {
          console.log(`[Download] DL ${libJarName}...`);
          let libUrl = downloadUrl;

          // Check if we're using a Mojang library host and build FabricMC fallback
          let fabricFallback = '';
          try {
            const parsed = new URL(downloadUrl);
            if (parsed.hostname.includes('libraries.minecraft.net')) {
              fabricFallback = buildFabricLibUrl(lib.name);
            }
          } catch {
            // Invalid URL, skip
          }

          try {
            await this.downloadFile(
              libUrl,
              libJarPath,
              (p) => {
                if (typeof p.percent === 'number') {
                  console.log(`[Download] ${libJarName}: ${p.percent}%`);
                }
                onProgress?.({
                  type: 'progress',
                  message: `Descargando ${libJarName}...`,
                  percent: Math.round((downloadedCount / totalFiles) * 100)
                });
              }
            );
            downloadedFiles.push(libJarName);
            console.log(`[Download] OK ${libJarName}`);
          } catch (e) {
            // Try FabricMC fallback if available
            if (fabricFallback) {
              console.log(`[Download] Trying FabricMC fallback for ${libJarName}`);
              try {
                await this.downloadFile(
                  fabricFallback,
                  libJarPath,
                  (p) => {
                    if (typeof p.percent === 'number') {
                      console.log(`[Download] ${libJarName} (FabricMC): ${p.percent}%`);
                    }
                    onProgress?.({
                      type: 'progress',
                      message: `Descargando ${libJarName} (mirror)...`,
                      percent: Math.round((downloadedCount / totalFiles) * 100)
                    });
                  }
                );
                downloadedFiles.push(libJarName);
                console.log(`[Download] OK ${libJarName} (from FabricMC)`);
              } catch (e2) {
                console.log(`[Download] FabricMC fallback failed for ${libJarName}: ${(e2 as Error).message}`);
                throw e;
              }
            } else {
              throw e;
            }
          }
        }

        downloadedCount++;
        const percent = Math.round((downloadedCount / totalFiles) * 100);
        onProgress?.({ type: 'progress', message: `Progreso: ${downloadedCount}/${totalFiles}`, percent });
      }

      // Download assets index if available
      if (versionDetails.assets) {
        // assets can be a string URL or an object {id, url}
        let assetIndexUrl: string | null = null;

        if (typeof versionDetails.assets === 'string') {
          assetIndexUrl = versionDetails.assets;
        } else if (versionDetails.assets && typeof versionDetails.assets === 'object') {
          // Try to get URL from assets object
          const assetsObj = versionDetails.assets as { id?: string; url?: string };
          if (assetsObj.url) {
            assetIndexUrl = assetsObj.url;
          }
        }

        if (assetIndexUrl) {
          onProgress?.({ type: 'status', message: 'Descargando assets...' });
          console.log(`[Download] Downloading assets index...`);

          const assetIndexPath = path.join(assetsDir, 'assets.json');
          await this.downloadFile(
            assetIndexUrl,
            assetIndexPath,
            (p) => {
              console.log(`[Download] Assets index: ${p.percent}%`);
              onProgress?.({ ...p, message: 'Descargando assets index...' });
            }
          );
          downloadedFiles.push('assets-index');
          console.log(`[Download] ✓ Assets index descargado`);
        }
      }

      return {
        success: true,
        message: `Versión ${version} descargada correctamente`,
        downloadedFiles,
      };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: err.message, errorCode: 'ERR_DOWNLOAD_FAILED' };
    }
  }

  /**
   * Check if a version is installed and complete
   */
  async isVersionInstalled(version: string): Promise<boolean> {
    const clientJar = path.join(this.gameDir, 'versions', version, `${version}.jar`);
    return fs.pathExists(clientJar);
  }

  get gameDirectory(): string {
    return this.gameDir;
  }
}