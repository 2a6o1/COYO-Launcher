/**
 * Minecraft Launcher MVP - Renderer UI Controller
 * Handles user interactions and communicates with main process via IPC
 */

// DOM elements
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const versionSelect = document.getElementById('version') as HTMLSelectElement;
const downloadVersionBtn = document.getElementById('download-version-btn') as HTMLButtonElement;
const launchBtn = document.getElementById('launch-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const logsDiv = document.getElementById('logs') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const progressFill = document.getElementById('progress-fill') as HTMLDivElement;

// App state
let versions: { id: string; type: string; url: string; time: string; releaseTime: string }[] = [];
let selectedVersion: string = '';
let javaPath: string | null = null;

// Offline fallback versions (last known good)
const OFFLINE_VERSIONS = [
  { id: '1.20.4', type: 'release', time: '2024-06-13T15:00:00Z', releaseTime: '2024-06-13T15:00:00Z', url: '' },
  { id: '1.20.3', type: 'release', time: '2024-03-01T00:00:00Z', releaseTime: '2024-03-01T00:00:00Z', url: '' },
  { id: '1.20.2', type: 'release', time: '2023-12-01T00:00:00Z', releaseTime: '2023-12-01T00:00:00Z', url: '' },
  { id: '1.20.1', type: 'release', time: '2023-05-23T00:00:00Z', releaseTime: '2023-05-23T00:00:00Z', url: '' },
  { id: '1.19.4', type: 'release', time: '2023-02-13T00:00:00Z', releaseTime: '2023-02-13T00:00:00Z', url: '' },
  { id: '1.18.2', type: 'release', time: '2022-08-03T00:00:00Z', releaseTime: '2022-08-03T00:00:00Z', url: '' },
  { id: '1.17.1', type: 'release', time: '2021-06-08T00:00:00Z', releaseTime: '2021-06-08T00:00:00Z', url: '' },
];

// Type assertion for window.mcpAPI (defined in preload.ts)
declare const mcpAPI: {
  getVersions: () => Promise<{ success: boolean; versions?: typeof versions; error?: string }>;
  checkJava: () => Promise<{ success: boolean; java?: { path: string; version: string }; error?: string }>;
  launch: (config: { version: string; nickname: string; javaPath?: string }) => Promise<{ success: boolean; message: string; errorCode?: string }>;
  downloadVersion: (version: string) => Promise<{ success: boolean; message: string; errorCode?: string; downloadedFiles?: string[] }>;
  checkVersionInstalled: (version: string) => Promise<{ installed: boolean }>;
  onProgress: (callback: (progress: { type: string; message: string; percent?: number }) => void) => () => void;
};

/**
 * Log a message to the logs container
 */
function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const entry = document.createElement('div');
  entry.className = `log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logsDiv.appendChild(entry);
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

/**
 * Update the status indicator
 */
function setStatus(message: string, type: 'ready' | 'working' | 'error' | 'warning' = 'ready'): void {
  statusDiv.textContent = `Estado: ${message}`;
  statusDiv.className = 'status-indicator';
  if (type === 'error') statusDiv.classList.add('error');
  if (type === 'warning') statusDiv.classList.add('warning');
}

/**
 * Set button loading state
 */
function setLoading(button: HTMLButtonElement, loading: boolean): void {
  const btnText = button.querySelector('.btn-text') as HTMLSpanElement;
  const btnLoader = button.querySelector('.btn-loader') as HTMLSpanElement;

  if (loading) {
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'inline';
    button.disabled = true;
  } else {
    if (btnText) btnText.style.display = 'inline';
    if (btnLoader) btnLoader.style.display = 'none';
    button.disabled = false;
  }
}

/**
 * Update progress bar
 */
function setProgress(percent: number, message?: string): void {
  progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (percent >= 100) {
    progressFill.classList.add('complete');
  } else {
    progressFill.classList.remove('complete');
  }
  if (message) {
    statusDiv.textContent = `Estado: ${message}`;
  }
}

/**
 * Show or hide progress bar
 */
function showProgress(show: boolean): void {
  progressBar.style.display = show ? 'block' : 'none';
  if (!show) {
    progressFill.style.width = '0%';
    progressFill.classList.remove('complete');
  }
}

/**
 * Validate form inputs
 */
function isValid(): boolean {
  const nickname = nicknameInput.value.trim();
  const version = versionSelect.value;
  return nickname.length > 0 && version.length > 0;
}

/**
 * Update launch button state based on form validity
 */
function updateButtonState(): void {
  launchBtn.disabled = !isValid();
}

/**
 * Fetch and populate available versions
 */
async function loadVersions(): Promise<void> {
  try {
    setStatus('Cargando versiones...');
    const result = await mcpAPI.getVersions();

    if (result.success && result.versions) {
      versions = result.versions;
      log('Versiones descargadas desde Mojang');
    } else {
      // Fallback to offline versions
      console.warn('Using offline fallback versions:', result.error);
      versions = OFFLINE_VERSIONS;
      log(`Usando versiones offline (sin conexión: ${result.error})`, 'warning');
    }

    // Clear and repopulate select
    versionSelect.innerHTML = '';

    // Sort versions: releases first, then by date
    const sortedVersions = [...versions].sort((a, b) => {
      if (a.type === 'release' && b.type !== 'release') return -1;
      if (b.type === 'release' && a.type !== 'release') return 1;
      return new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime();
    });

    for (const v of sortedVersions) {
      const option = document.createElement('option');
      option.value = v.id;
      option.textContent = `${v.id} (${v.type})`;
      versionSelect.appendChild(option);
    }

    // Select latest version by default
    if (sortedVersions.length > 0) {
      versionSelect.value = sortedVersions[0].id;
      selectedVersion = sortedVersions[0].id;
      log(`Version ${sortedVersions[0].id} cargada`);
    }

    setStatus('Listo', 'ready');
    updateButtonState();
  } catch (error) {
    const err = error as Error;
    log(`Error cargando versiones: ${err.message}`, 'error');
    setStatus('Error al cargar versiones', 'error');
  }
}

/**
 * Check Java installation
 */
async function checkJava(): Promise<void> {
  try {
    const result = await mcpAPI.checkJava();

    if (result.success && result.java) {
      javaPath = result.java.path;
      log(`Java ${result.java.version} encontrado en: ${result.java.path}`);
    } else {
      log('Java no encontrado o no válido', 'warning');
    }
  } catch (error) {
    const err = error as Error;
    log(`Error verificando Java: ${err.message}`, 'warning');
  }
}

/**
 * Check if version is installed
 */
async function checkVersionInstalled(): Promise<boolean> {
  if (!selectedVersion) return false;
  try {
    const result = await mcpAPI.checkVersionInstalled(selectedVersion);
    return result.installed;
  } catch {
    return false;
  }
}

/**
 * Download version
 */
async function downloadVersion(): Promise<void> {
  if (!selectedVersion) {
    log('Selecciona una versión primero', 'warning');
    return;
  }

  setLoading(downloadVersionBtn, true);
  showProgress(true);
  setStatus('Descargando...', 'working');

  // Setup progress listener
  const unsubscribe = mcpAPI.onProgress((progress) => {
    if (progress.type === 'progress' && typeof progress.percent === 'number') {
      setProgress(progress.percent, progress.message);
    } else if (progress.type === 'status') {
      log(progress.message, 'info');
    } else if (progress.type === 'complete') {
      log(progress.message, 'success');
      setProgress(100);
      setTimeout(() => showProgress(false), 1500);
    } else if (progress.type === 'error') {
      log(progress.message, 'error');
      showProgress(false);
    }
  });

  try {
    const isInstalled = await checkVersionInstalled();
    if (isInstalled) {
      log(`Versión ${selectedVersion} ya está descargada`, 'success');
      setProgress(100);
      setTimeout(() => {
        showProgress(false);
      }, 1500);
      return;
    }

    const result = await mcpAPI.downloadVersion(selectedVersion);

    if (result.success) {
      log(`✅ ${result.message}`, 'success');
      setProgress(100);
      if (result.downloadedFiles) {
        log(`Archivos: ${result.downloadedFiles.join(', ')}`, 'info');
      }
    } else {
      log(`Error: ${result.message} (${result.errorCode})`, 'error');
    }
  } catch (error) {
    const err = error as Error;
    log(`Error descargando versión: ${err.message}`, 'error');
  } finally {
    setLoading(downloadVersionBtn, false);
    unsubscribe();
  }
}

/**
 * Launch Minecraft
 */
async function launchGame(): Promise<void> {
  const nickname = nicknameInput.value.trim();
  const version = versionSelect.value;

  if (!nickname) {
    log('El nickname es requerido', 'error');
    setStatus('Nickname requerido', 'error');
    return;
  }

  if (!version) {
    log('Debes seleccionar una versión', 'error');
    setStatus('Versión requerida', 'error');
    return;
  }

  setLoading(launchBtn, true);
  setStatus('Iniciando...', 'working');
  log(`Iniciando Minecraft ${version} como ${nickname}`);

  // Setup progress listener
  const unsubscribe = mcpAPI.onProgress((progress) => {
    if (progress.type === 'progress' && typeof progress.percent === 'number') {
      setProgress(progress.percent, progress.message);
    } else if (progress.type === 'status') {
      log(progress.message, 'info');
    } else if (progress.type === 'complete') {
      log(progress.message, 'success');
    } else if (progress.type === 'error') {
      log(progress.message, 'error');
    }
  });

  try {
    const result = await mcpAPI.launch({
      version,
      nickname,
      javaPath: javaPath || undefined,
    });

    if (result.success) {
      log('¡Minecraft iniciado correctamente!', 'success');
      setStatus('Iniciado', 'ready');
    } else {
      log(`Error: ${result.message} (${result.errorCode})`, 'error');
      setStatus(result.message, 'error');

      if (result.errorCode === 'ERR_VERSION_NOT_DOWNLOADED') {
        log('Haz click en el botón de descarga (⬇) para descargar la versión');
      }
      if (result.errorCode === 'ERR_JAVA_NOT_FOUND') {
        log('Necesitas instalar Java 17 o superior');
      }
    }
  } catch (error) {
    const err = error as Error;
    log(`Error crítico: ${err.message}`, 'error');
    setStatus('Error crítico', 'error');
  } finally {
    setLoading(launchBtn, false);
    showProgress(false);
    unsubscribe();
  }
}

/**
 * Handle form changes
 */
function handleFormChange(): void {
  updateButtonState();
}

/**
 * Handle version selection change - check if installed
 */
async function handleVersionChange(): Promise<void> {
  const installed = await checkVersionInstalled();
  if (installed) {
    log(`✓ ${versionSelect.value} está descargada`, 'success');
  } else {
    log(`✗ ${versionSelect.value} no está descargada`, 'warning');
  }
  updateButtonState();
}

// Event Listeners
nicknameInput.addEventListener('input', handleFormChange);
versionSelect.addEventListener('change', async () => {
  selectedVersion = versionSelect.value;
  await handleVersionChange();
});

refreshBtn.addEventListener('click', async () => {
  versions = [];
  await loadVersions();
});

downloadVersionBtn.addEventListener('click', downloadVersion);
launchBtn.addEventListener('click', launchGame);

// Initialize app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  log('Iniciando FallenAngel Launcher...');
  await loadVersions();
  await checkJava();
  log('Launcher listo para usar');
});