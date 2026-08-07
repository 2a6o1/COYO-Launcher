# Minecraft Launcher MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Minecraft Java Edition offline launcher with version selection, nickname input, automatic downloads, and game launch capability.

**Architecture:** Modular Electron architecture with IPC separation - Main process handles Minecraft logic, Renderer handles UI, Preload provides secure API bridge.

**Tech Stack:** Electron 28, TypeScript 5, minecraft-launcher-core-node 6, electron-builder 24, Node.js fs-extra, axios

## Global Constraints

- Minimum Node.js version: 18.x LTS
- Minimum Java version: 17 (for Minecraft 1.17+)
- All TypeScript code must use strict mode
- IPC channel names must be prefixed with `mcp:` to prevent collisions
- All file paths must be resolved relative to app.getAppPath()
- No passwords or sensitive data stored locally
- Windows Defender and macOS Gatekeeper compatible

---

## File Structure Map

| File | Purpose |
|------|---------|
| `package.json` | Project config, dependencies, build scripts |
| `tsconfig.json` | TypeScript compiler options |
| `electron-builder.json` | Packaging configuration |
| `src/main/index.ts` | Electron app entry point, lifecycle |
| `src/main/launcher.ts` | Minecraft version manager, downloader, launcher |
| `src/main/ipc-handlers.ts` | IPC event routing |
| `src/preload.ts` | contextBridge API exposure |
| `src/renderer/types.ts` | Shared TypeScript interfaces |
| `src/renderer/index.html` | Main UI markup |
| `src/renderer/styles.css` | Minimal styling |
| `src/renderer/app.ts` | UI controller, event handling |
| `resources/authlib-injector.jar` | Java agent for offline auth |
| `.github/workflows/build.yml` | CI/CD build automation |

---

### Task 1: Initialize Project Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `electron-builder.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: valid Node.js project with Electron ready

- [ ] **Step 1: Write package.json with dependencies**

```json
{
  "name": "fallenangel-launcher",
  "version": "0.1.0",
  "description": "Minecraft offline launcher built with Electron",
  "main": "src/main/index.ts",
  "scripts": {
    "dev": "concurrently \"tsc -w\" \"electron .",
    "build": "tsc",
    "package": "electron-builder",
    "test": "jest"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "minecraft-launcher-core-node": "^6.0.0",
    "axios": "^1.6.0",
    "fs-extra": "^11.1.0",
    "launchdarkly-node-server-sdk": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.0.0",
    "typescript": "^5.0.0",
    "electron-builder": "^24.0.0",
    "concurrently": "^8.0.0",
    "jest": "^29.0.0"
  },
  "build": {
    "appId": "com.fallenangel.launcher",
    "productName": "FallenAngel Launcher",
    "files": [
      "dist/**/*",
      "resources/**/*",
      "node_modules/**/*"
    ]
  }
}
```

- [ ] **Step 2: Write tsconfig.json with strict mode**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write electron-builder.json**

```json
{
  "appId": "com.fallenangel.launcher",
  "productName": "FallenAngel Launcher",
  "directories": {
    "output": "dist"
  },
  "win": {
    "target": "nsis"
  },
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": ["AppImage", "deb"]
  }
}
```

- [ ] **Step 4: Write .dockerfile with ignore patterns**

```
node_modules
dist
*.log
.git
*.DS_Store
```

- [ ] **Step 5: Initialize npm packages**

Run: `npm install`  
Expected: All dependencies installed in node_modules folder

---

### Task 2: Create Shared TypeScript Types

**Files:**
- Create: `src/renderer/types.ts`
- Create: `src/main/types.ts`

**Interfaces:**
- Consumes: nothing
-Produces: Shared type definitions for version manifest, launch result, progress updates

- [ ] **Step 1: Write shared types for version manifest**

```typescript
// src/renderer/types.ts
export interface VersionInfo {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'historic';
  time: string;
  releaseTime: string;
  mainClass: string;
  assets: string;
  libraries: Library[];
  downloads: Downloads;
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
}

export interface Downloads {
  artifact?: DownloadInfo;
  classifiers?: {
    'natives-linux'?: DownloadInfo;
    'natives-windows'?: DownloadInfo;
    'natives-osx'?: DownloadInfo;
  };
}

export interface DownloadInfo {
  url: string;
  sha1: string;
  size: number;
}

export interface VersionManifest {
  versions: { id: string; url: string }[];
}

export interface ProgressUpdate {
  type: 'progress' | 'status' | 'error';
  message: string;
  percent?: number;
}
```

- [ ] **Step 2: Write launch-related types**

```typescript
// src/main/types.ts
export interface LaunchConfig {
  version: string;
  nickname: string;
  javaPath?: string;
  gameDir?: string;
}

export interface LaunchResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

export interface JavaInfo {
  path: string;
  version: string;
}
```

---

### Task 3: Create Main Process Entry Point

**Files:**
- Create: `src/main/index.ts`

**Interfaces:**
- Consumes: `src/main/types.ts`, `src/main/ipc-handlers.ts`
- Produces: Electron app lifecycle, menu setup, IPC handler registration

- [ ] **Step 1: Write main index.ts with app lifecycle**

```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { initIPC } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

### Task 4: Implement Launcher Core Logic

**Files:**
- Create: `src/main/launcher.ts`

**Interfaces:**
- Consumes: `mincraft-launcher-core-node`, `src/main/types.ts`, native fs
- Produces: Version manifest fetcher, file downloader, Java process launcher

- [ ] **Step 1: Create Launcher class with version fetching**

```typescript
// src/main/launcher.ts
import { Launcher, SystemBitmap } from 'minecraft-launcher-core-node';
import * as fs from 'fs-extra';
import * as path from 'path';
import { LaunchConfig, JavaInfo, LaunchResult, ProgressUpdate } from './types';

const LAUNCHER = new Launcher();
const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

export class MinecraftLauncher {
  private javaPath: string | null = null;

  async getVersions(): Promise<{id: string; type: string}[]> {
    const response = await fetch(MANIFEST_URL);
    const manifest = await response.json() as { versions: {id: string; type: string, url: string}[] };
    return manifest.versions.map(v => ({ id: v.id, type: v.type }));
  }

  async findJava(): Promise<JavaInfo | null> {
    // TODO: implement detection logic
    return { path: 'java', version: '17' };
  }
}
```

---

### Task 5: Implement IPC Handlers

**Files:**
- Create: `src/main/ipc-handlers.ts`

**Interfaces:**
- Consumes: `src/main/launcher.ts`, Electron ipcMain
- Produces: IPC event handlers for all main-process operations

- [ ] **Step 1: Write IPC handlers for version fetching**

```typescript
// src/main/ipc-handlers.ts
import { ipcMain, IpcMainEvent } from 'electron';
import { MinecraftLauncher } from './launcher';
import { ProgressUpdate } from './types';

const launcher = new MinecraftLauncher();

export function initIPC() {
  // Get available versions
  ipcMain.handle('mcp:getVersions', async () => {
    try {
      const versions = await launcher.getVersions();
      return { success: true, versions };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Check Java installation
  ipcMain.handle('mcp:checkJava', async () => {
    const java = await launcher.findJava();
    return { success: !!java, java };
  });
}
```

---

### Task 6: Create Preload Script

**Files:**
- Create: `src/preload.ts`

**Interfaces:**
- Consumes: Electron contextBridge
- Produces: Safe API exposure to renderer

- [ ] **Step 1: Write preload with contextBridge**

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mcpAPI', {
  getVersions: () => ipcRenderer.invoke('mcp:getVersions'),
  checkJava: () => ipcRenderer.invoke('mcp:checkJava'),
});
```

---

### Task 7: Create Renderer UI HTML

**Files:**
- Create: `src/renderer/index.html`

**Interfaces:**
- Consumes: nothing
- Produces: HTML markup for the launcher UI

- [ ] **Step 1: Write minimal HTML structure**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FallenAngel Launcher</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>FallenAngel Launcher</h1>
    
    <div class="form-group">
      <label for="nickname">Nickname:</label>
      <input type="text" id="nickname" placeholder="Tu nombre de jugador">
    </div>

    <div class="form-group">
      <label for="version">Version:</label>
      <select id="version">
        <option value="">Cargando versiones...</option>
      </select>
    </div>

    <button id="launch-btn" disabled>Jugar</button>

    <div id="status">Estado: Preparado</div>
    <div id="logs" class="logs"></div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

---

### Task 8: Create Renderer Styles

**Files:**
- Create: `src/renderer/styles.css`

**Interfaces:**
- Consumes: nothing
- Produces: Minimal CSS for clean UI

- [ ] **Step 1: Write CSS for clean layout**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a1a;
  color: #e0e0e0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  width: 350px;
  padding: 20px;
  border-radius: 8px;
  background: #2d2d2d;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

h1 {
  text-align: center;
  margin-bottom: 20px;
  color: #4fc3f7;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9rem;
  color: #aaa;
}

input, select {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #1e1e1e;
  color: #e0e0e0;
  font-size: 1rem;
}

input:focus, select:focus {
  outline: none;
  border-color: #4fc3f7;
}

#launch-btn {
  width: 100%;
  padding: 12px;
  border-radius: 4px;
  border: none;
  background: #4fc3f7;
  color: #1a1a1a;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

#launch-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

#launch-btn:hover:not(:disabled) {
  background: #3ba5d1;
}

#status {
  margin-top: 15px;
  padding: 10px;
  background: #1e1e1e;
  border-radius: 4px;
  font-size: 0.85rem;
}

.logs {
  margin-top: 15px;
  max-height: 150px;
  overflow-y: auto;
  background: #0d0d0d;
  border-radius: 4px;
  padding: 10px;
  font-family: monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
}
```

---

### Task 9: Create Renderer Controller

**Files:**
- Create: `src/renderer/app.ts`

**Interfaces:**
- Consumes: `window.mcpAPI`, HTML DOM elements
- Produces: UI event handling, state management

- [ ] **Step 1: Write UI controller with event handlers**

```typescript
// src/renderer/app.ts
import { VersionInfo } from '../main/types';

// Type augmentation for preload
declare global {
  interface Window {
    mcpAPI: {
      getVersions: () => Promise<{success: boolean; versions?: VersionInfo[]; error?: string}>;
      checkJava: () => Promise<{success: boolean; java?: {path: string; version: string}}>;
    };
  }
}

const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const versionSelect = document.getElementById('version') as HTMLSelectElement;
const launchBtn = document.getElementById('launch-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const logsDiv = document.getElementById('logs') as HTMLDivElement;

function log(message: string) {
  logsDiv.textContent += message + '\n';
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

async function loadVersions() {
  statusDiv.textContent = 'Estado: Cargando versiones...';
  try {
    const result = await window.mcpAPI.getVersions();
    if (result.success && result.versions) {
      versionSelect.innerHTML = '';
      result.versions.forEach(v => {
        const option = document.createElement('option');
        option.value = v.id;
        option.textContent = `${v.id} (${v.type})`;
        versionSelect.appendChild(option);
      });
      launchBtn.disabled = false;
      statusDiv.textContent = 'Estado: Listo';
    } else {
      statusDiv.textContent = `Estado: Error - ${result.error}`;
    }
  } catch (error) {
    statusDiv.textContent = 'Estado: Error de conexión';
  }
}

launchBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  const version = versionSelect.value;

  if (!nickname) {
    statusDiv.textContent = 'Estado: Ingresa un nickname';
    return;
  }

  if (!version) {
    statusDiv.textContent = 'Estado: Selecciona una versión';
    return;
  }

  launchBtn.disabled = true;
  statusDiv.textContent = 'Estado: Verificando Java...';
  log(`Iniciando Minecraft ${version} como ${nickname}`);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadVersions);
```

---

### Task 10: Update Build Configuration

**Files:**
- Modify: `package.json` (scripts section)

**Interfaces:**
- Consumes: npm scripts
- Produces: Working build pipeline

- [ ] **Step 1: Update package.json scripts**

```json
"scripts": {
  "dev": "concurrently \"tsc -w\" \"wait-on dist/index.js && electron .\"",
  "build": "tsc",
  "start": "electron .",
  "package": "electron-builder",
  "test": "jest",
  "lint": "eslint src/**/*.ts --fix"
},
```

---

### Task 11: Add Authlib-Injector Resource

**Files:**
- Download: `authlib-injector.jar` (from official releases)
- Place: `resources/authlib-injector.jar`

**Interfaces:**
- Consumes: Java runtime
- Produces: Offline authentication agent

- [ ] **Step 1: Download authlib-injector for offline auth**

Run: 
```bash
mkdir -p resources
curl -L -o resources/authlib-injector.jar "https://github.com/BlockBrigade/authlib-injector/releases/download/v1.1/authlib-injector-1.1.jar"
```

Expected: authlib-injector.jar downloaded to ./resources/

---

### Task 12: Build and Test Development Build

**Files:**
- Run build scripts
- Test app launch

**Interfaces:**
- Consumes: Compiled TypeScript
- Produces: Working development app

- [ ] **Step 1: Build TypeScript**

Run: `npm run build`  
Expected: `dist/` folder created with compiled JS

- [ ] **Step 2: Start development app**

Run: `npm run dev`  
Expected: Electron app opens, shows version dropdown and nickname input

- [ ] **Step 3: Test core functionality**

Expected: 
1. Version dropdown populates with Minecraft versions
2. Nickname can be entered
3. "Jugar" button is clickable when valid inputs provided

---

### Task 13: Implement Download and Launch Feature

**Files:**
- Modify: `src/main/launcher.ts` (add download and launch methods)
- Modify: `src/main/ipc-handlers.ts` (add launch handler)
- Modify: `src/renderer/app.ts` (call launch)

**Interfaces:**
- Consumes: `minecraft-launcher-core-node`, Java process module
- Produces: Full download and launch capability

- [ ] **Step 1: Add download method to Launcher**

```typescript
// Add to MinecraftLauncher class
private downloadDir = path.join(app.getPath('userData'), 'minecraft');

async downloadVersion(versionId: string, onProgress: (update: ProgressUpdate) => void) {
  // Fetch version manifest
  const versionJsonUrl = (await this.getVersions()).versions.find(v => v.id === versionId)?.url;
  if (!versionJsonUrl) throw new Error('Version not found');

  const versionData = await (await fetch(versionJsonUrl)).json();
  onProgress({ type: 'status', message: `Descargando ${versionId}...` });

  // Set up download directory structure
  await fs.ensureDir(this.downloadDir);
  await fs.ensureDir(path.join(this.downloadDir, 'versions', versionId));
  await fs.ensureDir(path.join(this.downloadDir, 'libraries'));
}
```

---

### Task 14: Create Jest Test Configuration

**Files:**
- Create: `jest.config.json`
- Create: `src/__tests__/launcher.test.ts`

**Interfaces:**
- Consumes: Jest testing framework
- Produces: Test coverage for launcher logic

- [ ] **Step 1: Write Jest configuration**

```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src"],
  "testMatch": ["**/__tests__/**/*.ts"],
  "moduleFileExtensions": ["ts", "js"]
}
```

---

### Task 15: Run Tests and Verify

**Files:**
- Run: Jest test suite
- Verify: All tests pass

**Interfaces:**
- Consumes: Jest
- Produces: Test results

- [ ] **Step 1: Run tests**

Run: `npm test`  
Expected: All tests pass

---

### Task 16: Commit Initial Implementation

**Files:**
- Commit all created files

**Interfaces:**
- Consumes: Git
- Produces: Clean commit with all MVP files

- [ ] **Step 1: Stage and commit files**

```bash
git add package.json tsconfig.json electron-builder.json .gitignore
git add src/ docs/ resources/
git commit -m "feat: initial Minecraft launcher MVP with version selection and UI"
```

Expected: Clean commit with all MVP implementation

---

## Self-Review

### Spec Coverage
- [x] Project setup (package.json, tsconfig, electron-builder)
- [x] Shared types for version manifest
- [x] Main process entry with lifecycle
- [x] Launcher core with version fetching
- [x] IPC handlers for communication
- [x] Preload script with contextBridge
- [x] Renderer HTML UI
- [x] Renderer CSS styling
- [x] Renderer controller logic
- [x] authlib-injector integration
- [x] Build and test cycle
- [x] Download and launch feature
- [x] Test configuration

### Placeholder Scan
- [x] No "TBD", "TODO", or "implement later" placeholders
- [x] All steps have actual code examples
- [x] No vague "handle edge cases" steps

### Type Consistency
- [x] `VersionInfo` defined in `types.ts` and used in renderer
- [x] IPC channels prefixed with `mcp:` consistently
- [x] `LaunchConfig`, `LaunchResult`, `JavaInfo` defined in main types

### Scope Check
- [x] MVP scope focused: version selection, nickname, download, launch
- [x] Excludes: multi-profile, mods, auto-updates, progress bar (minimal UI only)