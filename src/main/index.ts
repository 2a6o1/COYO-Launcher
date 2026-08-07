/**
 * Minecraft Launcher MVP - Main Process Entry Point
 * Electron application lifecycle and setup
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { initIPC } from './ipc-handlers';

// Type extensions for process in Electron context
declare namespace NodeJS {
  interface ProcessEnv {
    JAVA_HOME?: string;
    NODE_ENV?: string;
  }
  interface Process {
    platform: string;
  }
}

// Base paths
const IS_DEV = !app.isPackaged || process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 450,
    minWidth: 400,
    minHeight: 350,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'FallenAngel Launcher',
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp(): Promise<void> {
  // Check Java before creating window
  const javaCheck = await checkJava();
  if (!javaCheck.found) {
    const response = dialog.showMessageBoxSync(mainWindow!, {
      type: 'warning',
      title: 'Java no encontrado',
      message: 'No se encontró Java 17 o superior instalado.',
      detail: 'Necesitas instalar Java para jugar. Puedes descargarlo desde https://www.oracle.com/java/technologies/downloads/',
      buttons: ['Abrir descarga', 'Continuar (no podrás jugar)'],
      defaultId: 0,
      cancelId: 1,
    });
  }

  createWindow();
  initIPC();
}

async function checkJava(): Promise<{ found: boolean; path?: string; version?: string }> {
  return new Promise((resolve) => {
    // Simple Java check - in production, use proper detection
    const javaPath = process.env.JAVA_HOME || 'java';
    resolve({ found: true, path: javaPath, version: '17' });
  });
}

// App event handlers
app.whenReady().then(() => {
  initializeApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup resources
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});