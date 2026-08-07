/**
 * Preload Script
 * Secure API exposure between main and renderer processes
 * Uses contextBridge for Electron security best practices
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer
const mcpAPI = {
  /**
   * Get available Minecraft versions
   */
  getVersions: async (): Promise<{ success: boolean; versions?: Array<{ id: string; type: string; url: string; time: string; releaseTime: string }>; error?: string }> => {
    return ipcRenderer.invoke('mcp:getVersions');
  },

  /**
   * Check Java installation
   */
  checkJava: async (): Promise<{ success: boolean; java?: { path: string; version: string }; error?: string }> => {
    return ipcRenderer.invoke('mcp:checkJava');
  },

  /**
   * Launch Minecraft with given configuration
   */
  launch: async (config: { version: string; nickname: string; javaPath?: string; gameDir?: string }):
    Promise<{ success: boolean; message: string; errorCode?: string; javaPath?: string; gameDir?: string }> => {
    return ipcRenderer.invoke('mcp:launch', config);
  },

  /**
   * Check if a specific version is already installed
   */
  checkVersionInstalled: async (version: string): Promise<{ installed: boolean }> => {
    return ipcRenderer.invoke('mcp:checkVersionInstalled', version);
  },

  /**
   * Download a specific version (future functionality)
   */
  downloadVersion: async (version: string): Promise<{ success: boolean; message: string; error?: string }> => {
    return ipcRenderer.invoke('mcp:downloadVersion', version);
  },

  /**
   * Listen for progress updates during download/launch
   */
  onProgress: (callback: (progress: { type: string; message: string; percent?: number }) => void): (() => void) => {
    ipcRenderer.on('mcp:progress', (_event, progress) => callback(progress));
    return () => ipcRenderer.removeListener('mcp:progress', callback);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('mcpAPI', mcpAPI);

// Type augmentation for TypeScript
declare global {
  interface Window {
    mcpAPI: typeof mcpAPI;
  }
}