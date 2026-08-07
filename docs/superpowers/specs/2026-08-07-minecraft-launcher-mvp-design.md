# FallenAngelLauncher MVP - Minecraft Offline Launcher Design

**Date:** 2026-08-07  
**Status:** approved by user  
**Version:** MVP Basic

---

## 1. Overview

A minimalistic Minecraft Java Edition launcher built with Electron that allows offline gameplay with version selection and nickname customization. The MVP focuses on core functionality: version selection, automatic download of required files, and launching Minecraft with a custom nickname in offline mode.

---

## 2. Architecture

### 2.1 Project Structure

```
FallenAngelLauncher/
├── src/
│   ├── main/
│   │   ├── index.ts        # Entry point Electron + app lifecycle
│   │   ├── launcher.ts     # Core Minecraft launch logic
│   │   └── ipc-handlers.ts # IPC event handlers
│   ├── renderer/
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app.ts          # UI controller
│   │   └── types.ts        # Shared TypeScript interfaces
│   └── preload.ts          # contextBridge para API segura
├── resources/
│   └── authlib-injector.jar
├── electron-builder.json
└── package.json
```

### 2.2 Process Architecture

- **Main Process (Node.js):** Handles Minecraft-specific logic, file downloads, Java process execution
- **Renderer Process (Chromium):** Pure UI layer, communicates via IPC
- **Preload Script:** Secure API bridge using `contextBridge`

### 2.3 Communication Flow

```
[Renderer] --IPC--> [Preload] --IPC--> [Main]
[Main] --IPC--> [Preload] --IPC--> [Renderer]
```

---

## 3. Components

| Component | File | Responsibility |
|-----------|------|----------------|
| App Entry | `src/main/index.ts` | Electron app lifecycle, menu, dialogs |
| Launcher Core | `src/main/launcher.ts` | Minecraft version manifest, downloads, Java process |
| IPC Handlers | `src/main/ipc-handlers.ts` | Route IPC events to launcher core |
| UI Controller | `src/renderer/app.ts` | DOM events, state management |
| Shared Types | `src/renderer/types.ts` | TypeScript interfaces |

---

## 4. Data Flow

### 4.1 Version Selection
```
1. App starts → IPC: "getVersions"
2. Main fetches https://launchermeta.mojang.com/mc/game/version_manifest.json
3. Main returns list → Renderer populates <select>
```

### 4.2 Launch Sequence
```
1. User clicks "Jugar" → IPC: "downloadAndLaunch"
2. Main checks: Java existence, disk space, internet
3. Main downloads: client.jar, libraries, natives
4. Main builds: classpath, arguments
5. Main spawns: java process
6. Main streams: stdout/stderr → IPC
7. Renderer displays: logs
```

---

## 5. Error Handling

| Error Code | Detection | User Message |
|------------|-----------|--------------|
| `ERR_JAVA_NOT_FOUND` | `which java` / PATH check | "Necesitas instalar Java 17+. Descargar →" |
| `ERR_NO_INTERNET` | fetch timeout | "Sin conexión. Sólo versiones descargadas previamente" |
| `ERR_DISK_FULL` | fs.statSync check | "Espacio insuficiente en disco" |
| `ERR_DOWNLOAD` | HTTP error / network | "Error descargando. Reintentar" |

---

## 6. Technical Specifications

### 6.1 Java Requirements

- **Minimum Version:** Java 17 (for Minecraft 1.17+)
- **Detection:** Search JAVA_HOME, PATH, Registry (Windows)

### 6.2 Launch Command

```bash
java \
  -Xmx2G \
  -javaagent:./resources/authlib-injector.jar \
  -cp "libraries/*:versions/1.20.4/1.20.4.jar" \
  net.minecraft.client.main.Main \
  --username "PlayerName" \
  --version "1.20.4" \
  --gameDir "./minecraft" \
  --assetsDir "./minecraft/assets" \
  --assetIndex "1.20" \
  --uuid "offline" \
  --accessToken "offline" \
  --userType "legacy" \
  --versionType "release"
```

### 6.3 Minecraft Folder Structure

```
./minecraft/
├── versions/
│   └── 1.20.4/
│       ├── 1.20.4.jar
│       └── 1.20.4.json
├── libraries/
├── assets/
│   ├── indexes/
│   └── objects/
└── launcher_profiles.json
```

---

## 7. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| electron | 28.x | Desktop app framework |
| typescript | 5.x | Type safety |
| minecraft-launcher-core-node | 6.x | Minecraft launch logic |
| electron-builder | 24.x | Packaging |
| authlib-injector | 1.1+ | Offline auth injection |

---

## 8. User Interface (MVP)

### 8.1 Required Elements
- Dropdown for version selection
- Text input for nickname
- "Jugar" button
- Status/output area (logs)

### 8.2 Optional (per plan)
- Progress bar
- Detailed logs
- Error dialogs

**Decision:** Basic status text only for MVP. Full logs in output area.

---

## 9. Packaging Targets

- Windows: `.exe` (NSIS installer)
- macOS: `.dmg` 
- Linux: `.AppImage` or `.deb`

---

## 10. Success Criteria

1. ✅ App launches and shows version dropdown
2. ✅ User can enter nickname and click "Jugar"
3. ✅ App downloads required files for selected version
4. ✅ Minecraft launches with correct nickname in offline mode
5. ✅ App packages for development testing