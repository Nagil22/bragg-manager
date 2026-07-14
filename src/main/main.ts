import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipcHandlers';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Bragg Manager',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:9000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

  // DevTools toggle — Cmd+Option+I (mac) / Ctrl+Shift+I (win/linux)
  // Available in both dev and packaged builds for performance profiling.
  const devToolsShortcut = process.platform === 'darwin' ? 'CommandOrControl+Alt+I' : 'CommandOrControl+Shift+I';
  globalShortcut.register(devToolsShortcut, () => {
    mainWindow?.webContents.toggleDevTools();
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
