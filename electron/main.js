/**
 * Electron main.js — Phase 2 updates.
 * New IPC handlers:
 *   - write-env: save API keys to backend .env
 *   - open-in-vscode: open algo file in VS Code (Claude Code extension)
 *   - open-secondary-window: detach panels to second monitor
 *   - file-watcher: watch algos/ dir, notify frontend on changes
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

let mainWindow;
let secondaryWindow;
let backendProcess;
let fileWatcher;

const isDev = !app.isPackaged;

// ── Backend path resolution ───────────────────────────────────────
function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', '..', 'backend')
    : path.join(process.resourcesPath, 'backend');

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--port', '8787', '--host', '0.0.0.0'], {
    cwd: backendPath,
    stdio: 'pipe',
    env: { ...process.env },
  });

  backendProcess.stdout.on('data', (data) => { console.log(`[Backend] ${data}`); });
  backendProcess.stderr.on('data', (data) => { console.error(`[Backend] ${data}`); });
  backendProcess.on('error', (err)  => { console.error('Failed to start backend:', err); });
}

// ── Main window ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920, height: 1080, minWidth: 1200, minHeight: 700,
    backgroundColor: '#030712',
    title: 'Lunar Terminal',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // for embedded ChatGPT/Claude/Gemini panels
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // Start file watcher for algos/ directory
  startAlgoWatcher(mainWindow);
}

// ── File watcher — algos/ directory ──────────────────────────────
function startAlgoWatcher(win) {
  const algosDir = isDev
    ? path.join(__dirname, '..', '..', 'backend', 'algos')
    : path.join(process.resourcesPath, 'backend', 'algos');

  if (!fs.existsSync(algosDir)) {
    fs.mkdirSync(algosDir, { recursive: true });
  }

  if (fileWatcher) fileWatcher.close();

  fileWatcher = fs.watch(algosDir, { persistent: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.py')) return;
    console.log(`[FileWatcher] ${eventType}: ${filename}`);

    // Auto-reload backend algos
    fetch('http://localhost:8787/algos/reload', { method: 'POST' }).catch(() => {});

    // Notify renderer so it can refresh the algo list
    if (win && !win.isDestroyed()) {
      win.webContents.send('algo-file-changed', { eventType, filename });
    }
  });

  console.log(`[FileWatcher] Watching ${algosDir}`);
}

// ── Secondary window (multi-monitor) ─────────────────────────────
function openSecondaryWindow() {
  if (secondaryWindow && !secondaryWindow.isDestroyed()) {
    secondaryWindow.focus();
    return;
  }

  secondaryWindow = new BrowserWindow({
    width: 1200, height: 900,
    title: 'Lunar Terminal — Secondary Monitor',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });

  const url = isDev
    ? 'http://localhost:5173/#secondary'
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}#secondary`;

  secondaryWindow.loadURL(url);
  secondaryWindow.on('closed', () => { secondaryWindow = null; });
}

// ── IPC Handlers ─────────────────────────────────────────────────

// Open algo file in local VS Code (supports Claude Code extension)
ipcMain.on('open-in-vscode', (event, filename) => {
  const algosDir = isDev
    ? path.join(__dirname, '..', '..', 'backend', 'algos')
    : path.join(process.resourcesPath, 'backend', 'algos');

  const filePath = path.join(algosDir, filename);

  // Ensure file exists
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# ${filename}\n# New algo — edit me!\n`);
  }

  try {
    // Try `code` CLI (VS Code)
    spawn('code', [filePath], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Fallback: open with system default
    shell.openPath(filePath);
  }
});

// Write-env: save an API key to backend .env file (called from Settings screen)
ipcMain.on('write-env', (event, { key, value }) => {
  const envPath = isDev
    ? path.join(__dirname, '..', '..', 'backend', '.env')
    : path.join(process.resourcesPath, 'backend', '.env');

  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    event.reply('write-env-result', { success: true });
  } catch (err) {
    console.error('[write-env] Error:', err);
    event.reply('write-env-result', { success: false, error: err.message });
  }
});

// Open secondary window for multi-monitor
ipcMain.on('open-secondary-window', () => { openSecondaryWindow(); });

// Detachable panel support
ipcMain.on('detach-panel', (event, { title, route, width, height }) => {
  const panel = new BrowserWindow({
    width: width || 800, height: height || 600,
    title: title || 'Stock Terminal',
    backgroundColor: '#0a0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });
  const url = isDev
    ? `http://localhost:5173/#${route}`
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}#${route}`;
  panel.loadURL(url);
});

// ── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 2000);
});

app.on('window-all-closed', () => {
  if (fileWatcher)    fileWatcher.close();
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate',     () => { if (!mainWindow) createWindow(); });
app.on('before-quit',  () => { if (backendProcess) backendProcess.kill(); });
