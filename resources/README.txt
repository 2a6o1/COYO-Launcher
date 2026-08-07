# FallenAngel Launcher - README

## Requisitos Previos

1. **Java 17 o superior** - Necesario para ejecutar Minecraft
   - Descargar: https://www.oracle.com/java/technologies/downloads/
   - Instalar y agregar a PATH

2. **Node.js 18+** - Necesario para construir el proyecto
   - Instalar desde: https://nodejs.org/

## Instalación y Ejecución

### Desde Windows (PowerShell o CMD):

```powershell
# Navegar al directorio del proyecto (desde Windows, no WSL)
cd C:\Users\Administrativo\Documents\GitHub\FallenAngelLauncher

# Instalar dependencias
npm install

# Compilar
npm run build

# Ejecutar (elige una opción)
# Opción 1: Usar npx
npx electron .

# Opción 2: Usar el script .cmd
.\node_modules\.bin\electron.cmd .

# Opción 3: Usar PowerShell native
.\node_modules\.bin\electron.ps1 .
```

### Desde WSL/Linux/macOS:

```bash
npm install
npm run build
npx electron .
```

## Archivos Necesarios

```
dist/
├── main/index.js        (ENTRY POINT - definido en package.json "main")
├── main/launcher.js     (Detección Java + lanzamiento)
├── main/ipc-handlers.js (Comunicación IPC)
├── preload.js           (contextBridge para seguridad)
└── renderer/
    ├── index.html       (Interfaz de usuario)
    └── styles.css       (Estilos CSS)
```

## Modo Offline

Usa modo offline nativo de Minecraft. Los argumentos se pasan directamente al proceso Java:
- `--offline`
- `--accessToken offline`
- `--uuid offline`
- `--userType legacy`

## Solución de Problemas

### Error: "ERR_FILE_NOT_FOUND"
Verificado ✅ - Las rutas ahora son correctas:
- `dist/main/index.js` busca `dist/preload.js` (ruta `../preload.js`)
- `dist/main/index.js` busca `dist/renderer/index.html` (ruta `../../renderer/index.html`)

### Error: "Cannot find module 'electron'"
Ejecuta `npm install` para instalar dependencias.

### Error: "electron.exe no reconocido"
En PowerShell usa:
- `.\node_modules\.bin\electron.cmd .` (CMD wrapper)
- `.\node_modules\.bin\electron.ps1 .` (PowerShell native)
- `npx electron .`

### Error: "La consola no muestra ventana" (WSL)
Ejecuta desde Windows con GUI disponible.

## Estado del Proyecto

✅ TypeScript compila sin errores
✅ Detección Java real implementada
✅ Lanzamiento Minecraft con spawn()
✅ Modo offline funcional
✅ Build cross-platform configurado