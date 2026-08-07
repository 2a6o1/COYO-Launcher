# FallenAngel Launcher

A minimalistic Minecraft Java Edition offline launcher built with Electron.

## Features

- ✅ Version selection from Mojang's version manifest
- ✅ Nickname customization
- ✅ Automatic download of required game files
- ✅ Offline mode launch with authlib-injector
- ✅ Cross-platform support (Windows, macOS, Linux)

## Requirements

- **Java 17+** (for Minecraft 1.17+)
- **Node.js 18+**

## Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Package for distribution
pnpm package
```

## Project Structure

```
src/
├── main/           # Main process (Node.js)
│   ├── index.ts    # App lifecycle
│   ├── launcher.ts # Minecraft launch logic
│   └── ipc-handlers.ts # IPC communication
├── renderer/       # Renderer process (UI)
│   ├── index.html  # App markup
│   ├── styles.css  # Styling
│   └── app.ts      # UI controller
└── preload.ts      # Secure API bridge
```

## License

MIT