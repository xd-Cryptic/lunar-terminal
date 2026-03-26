/**
 * Electron preload.js — exposes safe IPC APIs to the renderer.
 * Phase 2: added electronAPI with write-env, vscode, multi-monitor.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Legacy (keep for backwards compat) ──
  detachPanel: (options) => ipcRenderer.send('detach-panel', options),
  platform: process.platform,

  // ── Phase 2 ──
  /** Open algo file in local VS Code (with Claude Code extension) */
  openInVSCode: (filename) => ipcRenderer.send('open-in-vscode', filename),

  /** Write a key=value line to backend/.env */
  writeEnv: (key, value) => {
    ipcRenderer.send('write-env', { key, value });
    return new Promise(resolve => ipcRenderer.once('write-env-result', (_, result) => resolve(result)));
  },

  /** Listen for algo file changes from the file watcher */
  onAlgoChanged: (callback) => ipcRenderer.on('algo-file-changed', (_, data) => callback(data)),

  /** Open a secondary window for multi-monitor */
  openSecondaryWindow: () => ipcRenderer.send('open-secondary-window'),
});

// Keep old 'terminal' for any existing code that uses it
contextBridge.exposeInMainWorld('terminal', {
  detachPanel: (options) => ipcRenderer.send('detach-panel', options),
  platform: process.platform,
});
