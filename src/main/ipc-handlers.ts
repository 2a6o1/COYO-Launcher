/**
 * IPC Event Handlers
 * Routes IPC messages between renderer and main processes
 */

import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { MinecraftLauncher } from './launcher';
import { VersionManifest, LaunchConfig, ProgressUpdate, LaunchResult } from '../renderer/types';

const launcher = new MinecraftLauncher();
let mainWin: BrowserWindow | null = null;

// Track window for progress broadcasting
ipcMain.handle('mcp:setMainWindow', async (_event: IpcMainInvokeEvent, win: BrowserWindow) => {
  mainWin = win;
});

export function initIPC(): void {
  // Handle version manifest requests
  ipcMain.handle('mcp:getVersions', async (): Promise<{ success: boolean; versions?: VersionManifest['versions']; error?: string }> => {
    try {
      const manifest = await launcher.getVersionManifest();
      return { success: true, versions: manifest.versions };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Handle Java check
  ipcMain.handle('mcp:checkJava', async (): Promise<{ success: boolean; java?: { path: string; version: string }; error?: string }> => {
    try {
      const javaInfo = await launcher.findJava();
      return { success: true, java: { path: javaInfo.path, version: javaInfo.version } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Handle launch request
  ipcMain.handle('mcp:launch', async (
    _event: IpcMainInvokeEvent,
    config: LaunchConfig,
  ): Promise<LaunchResult> => {
    if (!config.version || !config.nickname) {
      return { success: false, message: 'Version y nickname son requeridos', errorCode: 'ERR_INVALID_CONFIG' };
    }

    return await launcher.launch(config, (progress: ProgressUpdate) => {
      // Broadcast progress updates to renderer
      if (mainWin) {
        mainWin.webContents.send('mcp:progress', progress);
      }
    });
  });

  // Handle check if version is installed
  ipcMain.handle('mcp:checkVersionInstalled', async (
    _event: IpcMainInvokeEvent,
    version: string,
  ): Promise<{ installed: boolean }> => {
    const clientJar = `versions/${version}/${version}.jar`;
    const isInstalled = await checkFileExists(launcher.gameDirectory, clientJar);
    return { installed: isInstalled };
  });

  // Handle download version - REAL implementation
  ipcMain.handle('mcp:downloadVersion', async (
    _event: IpcMainInvokeEvent,
    version: string,
  ): Promise<{ success: boolean; message: string; errorCode?: string; downloadedFiles?: string[] }> => {
    return await launcher.downloadVersion(version, (progress: ProgressUpdate) => {
      // Broadcast progress to renderer
      if (mainWin) {
        mainWin.webContents.send('mcp:progress', progress);
      }
    });
  });
}

/**
 * Helper function to check if a file exists
 */
async function checkFileExists(baseDir: string, relativePath: string): Promise<boolean> {
  const fs = await import('fs-extra');
  return fs.pathExists(path.join(baseDir, relativePath));
}