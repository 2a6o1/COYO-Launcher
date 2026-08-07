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
  Library,
} from '../renderer/types';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest.json';

export class MinecraftLauncher {
  // Known working client jar URLs (for versions where manifests are unavailable or slow)
  // These are direct piston-data.mojang.com URLs that still work
  private static readonly VERSION_MIRRORS: Record<string, { client: string; assets: string }> = {
    '1.20.4': {
      client: 'https://piston-data.mojang.com/v1/objects/fd19469fed4a4b4c15b2d5133985f0e3e7816a8a/client.jar',
      assets: 'https://piston-data.mojang.com/v1/objects/fd19469fed4a4b4c15b2d5133985f0e3e7816a8a/client.jar',
    },
    '1.20.3': {
      client: 'https://piston-data.mojang.com/v1/objects/b178a327a96f2cf1c9f98a45e5588d654a3e4369/client.jar',
      assets: 'https://piston-data.mojang.com/v1/objects/b178a327a96f2cf1c9f98a45e5588d654a3e4369/client.jar',
    },
    '1.20.2': {
      client: 'https://piston-data.mojang.com/v1/objects/82d1974e75fc984c5ed4b038e764e50958ac61a0/client.jar',
      assets: 'https://piston-data.mojang.com/v1/objects/82d1974e75fc984c5ed4b038e764e50958ac61a0/client.jar',
    },
    '1.21.7': {
      client: 'https://piston-data.mojang.com/v1/objects/a2db1ea98c37b2d00c83f6867fb8bb581a593e07/client.jar',
      assets: 'https://piston-data.mojang.com/v1/objects/a2db1ea98c37b2d00c83f6867fb8bb581a593e07/client.jar',
    },
    '1.21.8': {
      client: 'https://piston-data.mojang.com/v1/objects/a19d9badbea944a4369fd0059e53bf7286597576/client.jar',
      assets: 'https://piston-data.mojang.com/v1/objects/a19d9badbea944a4369fd0059e53bf7286597576/client.jar',
    },
    '26.2': {
      client: 'https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar',
      assets: 'https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar',
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
   * Get the size of a file at a URL (via HEAD request)
   */
  private async getUrlSize(urlStr: string): Promise<number | null> {
    return new Promise((resolve) => {
      const client = urlStr.startsWith('https') ? https : http;
      client.get(urlStr, (res) => {
        // Handle redirects
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            this.getUrlSize(redirectUrl).then(resolve).catch(() => resolve(null));
            return;
          }
        }
        const size = parseInt(res.headers['content-length'] || '0', 10);
        res.resume(); // Consume response data
        resolve(size > 0 ? size : null);
      }).on('error', () => resolve(null));
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
    const classpathParts: string[] = [];

    // Helper to check if assets exist
    const checkAssetsExist = async (): Promise<boolean> => {
      const assetsIndexDir = path.join(this.gameDir, 'assets', 'indexes');
      try {
        const files = await fs.readdir(assetsIndexDir);
        return files.length > 0;
      } catch {
        return false;
      }
    };

    // Add all JARs from libraries
    try {
      if (fs.existsSync(librariesPath)) {
        const jars = this.findJarsInDir(librariesPath);
        classpathParts.push(...jars);
      }
    } catch {
      // Use basic classpath if libraries not found
    }

    // Add client jar at the end
    classpathParts.push(clientJar);

    const classpath = classpathParts.join(path.delimiter);
    const nativesPath = path.join(this.gameDir, 'natives');
    const assetsDir = path.join(this.gameDir, 'assets');

    // Calculate asset index correctly:
    // For 1.20.x -> "20", for 1.19.x -> "19", for 1.21+ -> use major.minor
    let assetIndex = '';
    if (config.version.startsWith('1.')) {
      const parts = config.version.split('.');
      if (parts.length >= 2) {
        const minor = parseInt(parts[1], 10);
        // Versions 1.21+ use different asset indexing
        if (minor >= 21) {
          assetIndex = `${parts[0]}.${parts[1]}`;
        } else {
          assetIndex = String(minor);
        }
      }
    } else {
      assetIndex = config.version;
    }

    // For very old versions (1.12.2, etc.), assets don't exist
    if (config.version <= '1.12.2' || !assetIndex) {
      assetIndex = '';
    }

    const args: string[] = [
      '-cp',
      classpath,
      '-Xmx2G',
      `-Djava.library.path=${nativesPath}`,
      'net.minecraft.client.main.Main',
      '--username',
      config.nickname,
      '--version',
      config.version,
      '--gameDir',
      this.gameDir,
      '--assetsDir',
      assetsDir,
    ];

    // Only add asset index if it exists or if the version uses them
    if (assetIndex) {
      args.push('--assetIndex', assetIndex);
    }

    args.push(
      '--uuid',
      'offline',
      '--accessToken',
      'offline',
      '--userType',
      'legacy',
      '--offline', // Native offline mode
    );

    return args;
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

      // Log classpath for debugging
      const cpMatch = args.find(a => a === '-cp');
      const cpIndex = args.indexOf('-cp');
      if (cpIndex >= 0 && cpIndex + 1 < args.length) {
        console.log(`[Launch] Classpath has ${args[cpIndex + 1].split(path.delimiter).length} entries`);
      }

      console.log(`[Launch] Spawning: java ${args.join(' ')}`);
      console.log(`[Launch] CWD: ${this.gameDir}`);

      this.currentProcess = spawn(javaPath, args, {
        cwd: this.gameDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        // For Windows, ensure proper window handling
        windowsHide: false,
      });

      // Track if we've seen valid startup output
      let seenStartupOutput = false;
      let immediateError = false;
      let stderrOutput = '';

      // Give the process 2 seconds to show any immediate errors
      const startupTimeout = setTimeout(() => {
        if (!seenStartupOutput && !immediateError) {
          // Process is still running after 2 seconds - likely launched successfully
          console.log(`[Launch] Process running (no immediate errors)`);
        }
      }, 2000);

      this.currentProcess.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        if (!msg) return;

        stderrOutput += msg + '\n';
        console.log(`[Launch] STDERR: ${msg}`);
        onProgress?.({ type: 'status', message: msg });

        // Check for critical errors
        const isError = msg.includes('Error') || msg.includes('Exception') ||
                        msg.includes('ClassNotFoundException') ||
                        msg.includes('NoClassDefFoundError') ||
                        msg.includes('UnsatisfiedLinkError') ||
                        msg.includes('Failed to load');

        if (isError) {
          immediateError = true;
          onProgress?.({ type: 'error', message: msg });
        }
      });

      this.currentProcess.stdout?.on('data', (data) => {
        const msg = data.toString().trim();
        if (!msg) return;
        console.log(`[Launch] STDOUT: ${msg}`);

        // Look for Minecraft startup indicators
        if (msg.includes('[main]')) {
          seenStartupOutput = true;
        }
        // Filter out noisy progress output
        if (!msg.includes('[Progress') && !msg.includes('Loading class')) {
          onProgress?.({ type: 'status', message: msg });
        }
      });

      this.currentProcess.on('error', (err: Error) => {
        clearTimeout(startupTimeout);
        immediateError = true;
        console.log(`[Launch] SPAWN ERROR: ${err.message}`);
        onProgress?.({ type: 'error', message: `Error al lanzar Java: ${err.message}` });
      });

      this.currentProcess.on('close', (code) => {
        clearTimeout(startupTimeout);
        console.log(`[Launch] Process closed with code: ${code}`);

        if (immediateError) {
          onProgress?.({ type: 'error', message: `Minecraft falló: código ${code}` });
        } else if (code !== 0) {
          onProgress?.({ type: 'error', message: `Minecraft exit code: ${code}` });
        } else if (!seenStartupOutput) {
          // Process exited with 0 but we never saw startup output - might be a failure
          if (stderrOutput && stderrOutput.includes('Error')) {
            onProgress?.({ type: 'error', message: 'Error durante el lanzamiento' });
          } else {
            onProgress?.({ type: 'complete', message: `Minecraft iniciado` });
          }
        } else {
          onProgress?.({ type: 'complete', message: `Minecraft iniciado correctamente` });
        }
        this.currentProcess = null;
      });

      // Return "success" but note that we're monitoring for errors
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

      // Help to build alternative library URLs as fallbacks
      const buildFabricLibUrl = (libName: string): string => {
        const parts = libName.split(':');
        if (parts.length >= 3) {
          const groupId = parts[0];
          const artifactId = parts[1];
          const libVersion = parts[2];
          const libPath = groupId.replace(/\./g, '/') + `/${artifactId}/${libVersion}/${artifactId}-${libVersion}.jar`;
          // Try Maven Central first (works for public libraries)
          return `https://repo1.maven.org/maven2/${libPath}`;
        }
        return '';
      };

      // Download client jar - use mirror for old versions
      const clientJarPath = path.join(versionDir, `${version}.jar`);
      console.log(`[Download] Downloading client.jar (${version}.jar)`);
      onProgress?.({ type: 'progress', message: 'Descargando client.jar...', percent: 0 });

      // Get client URL - check VERSION_MIRRORS first for old versions
      const mirror = (MinecraftLauncher as any).VERSION_MIRRORS?.[version];
      // Handle both old (downloads.artifact.url) and new (downloads.client.url) structures
      const clientUrlFromManifest = versionDetails.downloads?.client?.url || versionDetails.downloads?.artifact?.url;
      const rawClientUrl = mirror?.client || clientUrlFromManifest;

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

      // Determine native classifier based on platform
      // For Windows, try to get the best native library (windows-x86_64 preferred, then windows)
      const platform = process.platform;
      let nativeLibraryKey = '';
      if (platform === 'win32') {
        nativeLibraryKey = 'natives-windows-x86_64'; // Try 64-bit first
      } else if (platform === 'darwin') {
        if (process.env.ARCH === 'arm64') {
          nativeLibraryKey = 'natives-macos-arm64';
        } else {
          nativeLibraryKey = 'natives-macos';
        }
      } else {
        nativeLibraryKey = 'natives-linux';
      }

      console.log(`[Download] Platform: ${platform}, Native key: ${nativeLibraryKey}`);

      // Track downloadable libraries (including natives as separate entries)
      interface DownloadableLib {
        name: string;
        url: string;
        isNative: boolean;
        baseName: string;
      }
      const downloadableLibs: DownloadableLib[] = [];
      libraries.forEach((lib: Library) => {
        if (!lib.name || !lib.downloads?.artifact?.url) return;
        const parts = lib.name.split(':');
        if (parts.length < 3) return;

        // Check if this is already a native library (has :natives- in name)
        const isNativeLib = lib.name.includes(':natives-');

        // Try to find URL for native version if this is a core library
        let nativeUrl = '';
        if (!isNativeLib && lib.downloads?.classifiers) {
          // Check classifiers for native
          const classifierKeys = ['natives-windows', 'natives-windows-x86', 'natives-windows-arm64', 'natives-linux', 'natives-osx', 'natives-macos', 'natives-macos-arm64'] as const;
          for (const key of classifierKeys) {
            if (lib.downloads.classifiers?.[key]?.url) {
              // Construct the native library entry name
              const nativeLibName = `${parts[0]}:${parts[1]}:${parts[2]}:${key}`;
              nativeUrl = lib.downloads.classifiers[key].url;
              downloadableLibs.push({ name: nativeLibName, url: nativeUrl, isNative: true, baseName: lib.name });
              break;
            }
          }
        }

        // Add the main artifact
        downloadableLibs.push({ name: lib.name, url: lib.downloads.artifact.url, isNative: false, baseName: lib.name });
      });

      console.log(`[Download] Total downloadable items (including natives): ${downloadableLibs.length}`);

      // Download all libraries and natives
      totalFiles = 1 + downloadableLibs.length; // 1 for client jar

      for (const libEntry of downloadableLibs) {
        if (!libEntry.url) {
          console.log(`[Download] SKIP invalid entry - no URL`);
          continue;
        }

        try {
          new URL(libEntry.url);
        } catch {
          console.log(`[Download] SKIP invalid URL`);
          continue;
        }

        // Parse library name (format: groupId:artifactId:version[:classifier])
        const libName = libEntry.name;
        const parts = libName.split(':');

        // Determine path for this library
        let libDir: string;
        let libJarName: string;

        if (libEntry.isNative && libEntry.baseName) {
          // Native library jar
          const baseParts = libEntry.baseName.split(':');
          if (parts.length >= 4 && parts[3]?.startsWith('natives-')) {
            const groupId = baseParts[0];
            const artifactId = baseParts[1];
            const libVersion = baseParts[2];
            const classifier = parts[3];

            const libDirParts = groupId.split('.');
            libDir = path.join(librariesDir, ...libDirParts, artifactId, libVersion);
            libJarName = `${artifactId}-${libVersion}-${classifier}.jar`;
          } else {
            continue;
          }
        } else {
          // Regular library
          const groupId = parts[0];
          const artifactId = parts[1];
          const libVersion = parts[2];

          const libDirParts = groupId.split('.');
          libDir = path.join(librariesDir, ...libDirParts, artifactId, libVersion);
          libJarName = `${artifactId}-${libVersion}.jar`;
        }

        await fs.ensureDir(libDir);
        const libJarPath = path.join(libDir, libJarName);

        // Check if library already exists with same size
        let needsDownload = true;
        try {
          const existingStats = await fs.stat(libJarPath);
          const expectedSize = libEntry.isNative
            ? (await this.getUrlSize(libEntry.url))
            : null;
          if (expectedSize && existingStats.size === expectedSize) {
            needsDownload = false;
            console.log(`[Download] SKIP ${libJarName} (exists, correct size)`);
          } else if (!expectedSize) {
            needsDownload = true;
          }
        } catch {
          needsDownload = true;
        }

        if (needsDownload) {
          const libUrl = libEntry.url;
          console.log(`[Download] DL ${libJarName}...`);

          // Check for FabricMC fallback
          let fabricFallback = '';
          try {
            const parsed = new URL(libUrl);
            if (parsed.hostname.includes('libraries.minecraft.net')) {
              fabricFallback = buildFabricLibUrl(libName);
            }
          } catch {}

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
      // The assetIndex field contains the correct URL for the assets index
      let assetIndexUrl: string | null = null;

      if (versionDetails.assetIndex?.url) {
        // Version manifest provides the direct URL to assets index
        assetIndexUrl = versionDetails.assetIndex.url;
      } else if (versionDetails.assets) {
        // Legacy format - assets is either a string ID or object with URL
        const assetsVersion = versionDetails.assets;
        if (typeof assetsVersion === 'object' && (assetsVersion as any).url) {
          assetIndexUrl = (assetsVersion as any).url;
        }
        // Note: For string assets IDs, we need to construct URL properly
        // Most modern versions have assetIndex.url, but if not, skip
      }

      if (assetIndexUrl) {
        onProgress?.({ type: 'status', message: 'Descargando assets...' });
        console.log(`[Download] Downloading assets index: ${assetIndexUrl}`);

        // Extract the asset index ID from the URL and use it as filename
        // URL format: https://piston-meta.mojang.com/v1/packages/{sha1}/{id}.json
        // We need to save it as {id}.json in assets/indexes/
        const urlParts = assetIndexUrl.split('/');
        const assetIndexFile = urlParts[urlParts.length - 1] || `${versionDetails.assetIndex?.id || 'assets'}.json`;

        // Alternative: use the id from assetIndex object if available
        const assetIndexId = versionDetails.assetIndex?.id;
        const indexPath = assetIndexId ? path.join(assetsDir, `${assetIndexId}.json`) : path.join(assetsDir, assetIndexFile);

        try {
          await this.downloadFile(
            assetIndexUrl,
            indexPath,
            (p) => {
              console.log(`[Download] Assets index: ${p.percent}%`);
              onProgress?.({ ...p, message: 'Descargando assets index...' });
            }
          );
          downloadedFiles.push('assets-index');
          console.log(`[Download] ✓ Assets index descargado como ${path.basename(indexPath)}`);
        } catch (assetsErr) {
          console.log(`[Download] Assets download failed (non-critical): ${(assetsErr as Error).message}`);
        }
      }

      return {
        success: true,
        message: `Versión ${version} descargada correctamente`,
        downloadedFiles,
      };
    } catch (error) {
      const err = error as Error;
      console.log(`[Download] ERROR: ${err.message}`);
      console.log(`[Download] STACK: ${err.stack}`);
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