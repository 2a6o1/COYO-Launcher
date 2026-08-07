/**
 * Minecraft Launcher MVP - Renderer UI Controller
 * Handles user interactions and communicates with main process via IPC
 */

// Type definitions for preload API
declare global {
  interface Window {
    mcpAPI: {
      getVersions: () => Promise<{ success: boolean; versions?: Array<{ id: string; type: string; url: string; time: string; releaseTime: string }>; error?: string }>;
      checkJava: () => Promise<{ success: boolean; java?: { path: string; version: string }; error?: string }>;
      launch: (config: { version: string; nickname: string; javaPath?: string; gameDir?: string }) =>
        Promise<{ success: boolean; message: string; errorCode?: string; javaPath?: string; gameDir?: string }>;
      checkVersionInstalled: (version: string) => Promise<{ installed: boolean }>;
      onProgress: (callback: (progress: { type: string; message: string; percent?: number }) => void) => () => void;
    };
  }
}

// DOM elements
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const versionSelect = document.getElementById('version') as HTMLSelectElement;
const launchBtn = document.getElementById('launch-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const logsDiv = document.getElementById('logs') as HTMLDivElement;

// App state
let versions: Array<{ id: string; type: string; url: string; time: string; releaseTime: string }> = [];
let selectedVersion: string = '';
let javaPath: string | null = null;

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
function setLoading(button: HTMLButtonElement, loading: boolean, text: string = 'Cargando...'): void {
  const btnText = button.querySelector('.btn-text') as HTMLSpanElement;
  const btnLoader = button.querySelector('.btn-loader') as HTMLSpanElement;

  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    button.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    button.disabled = false;
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
    const result = await window.mcpAPI.getVersions();

    if (result.success && result.versions) {
      versions = result.versions;

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
    } else {
      throw new Error(result.error || 'Error desconocido');
    }
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
    const result = await window.mcpAPI.checkJava();

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

  try {
    const result = await window.mcpAPI.launch({
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

      if (result.errorCode === 'ERR_JAVA_NOT_FOUND') {
        log('Necesitas instalar Java 17 o superior');
      }
    }
  } catch (error) {
    const err = error as Error;
    log(`Error crítico: ${err.message}`, 'error');
    setStatus('Error crítico', 'error');
  } finally {
    setLoading(launchBtn, false, 'Jugar');
  }
}

/**
 * Handle form changes
 */
function handleFormChange(): void {
  updateButtonState();
}

// Event Listeners
nicknameInput.addEventListener('input', handleFormChange);
versionSelect.addEventListener('change', handleFormChange);

refreshBtn.addEventListener('click', async () => {
  versions = [];
  await loadVersions();
});

launchBtn.addEventListener('click', launchGame);

// Initialize app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  log('Iniciando FallenAngel Launcher...');
  await loadVersions();
  await checkJava();
  log('Launcher listo para usar');
});

export {};