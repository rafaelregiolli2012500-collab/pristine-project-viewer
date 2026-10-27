/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
const { app, BrowserWindow, shell, protocol, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('MONIT.CAMPO');
if (process.platform === 'win32') app.setAppUserModelId('com.monit.campo');

const ICON_PATH = path.join(
  __dirname,
  '..',
  'build',
  process.platform === 'win32' ? 'icon.ico' : 'icon.png',
);

/** URL oficial do Painel Central (online). Não alterar sem necessidade. */
const CENTRAL_ADMIN_URL = 'https://monit-field-guard.lovable.app';

let mainWindow = null;
let adminWindow = null;

// Frontend compilado (Vite → dist-electron). Dentro do pacote, __dirname
// aponta para app.asar/electron, então o caminho relativo continua válido.
const RENDERER_DIR = path.join(__dirname, '..', 'dist-electron');
const ENTRY_FILE = 'index.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

// Esquema próprio: módulos ES não carregam sob file:// (bloqueio de CORS do Chromium).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function registerAppProtocol() {
  // Leitura via fs: funciona dentro do pacote asar, ao contrário de net.fetch(file://).
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const decoded = decodeURIComponent(pathname);
    const resolved = path.normalize(path.join(RENDERER_DIR, decoded));
    // Impede qualquer acesso fora do diretório empacotado
    let target =
      resolved.startsWith(RENDERER_DIR) ? resolved : path.join(RENDERER_DIR, ENTRY_FILE);
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      target = path.join(RENDERER_DIR, ENTRY_FILE);
    }
    try {
      const data = await fs.promises.readFile(target);
      const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': type } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'MONIT.CAMPO',
    width: 1600,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    center: true,
    show: false,
    backgroundColor: '#0B1018',
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    icon: nativeImage.createFromPath(ICON_PATH),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  const emitMaximized = () =>
    mainWindow?.webContents.send('window:maximized-changed', mainWindow.isMaximized());
  mainWindow.on('maximize', emitMaximized);
  mainWindow.on('unmaximize', emitMaximized);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Mantém o título oficial mesmo se a página tentar sobrescrevê-lo
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
    mainWindow.setTitle('MONIT.CAMPO');
  });

  // Links externos abrem no navegador padrão, nunca dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith('app://')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    }
  });

  mainWindow.loadURL(`app://monit.campo/${ENTRY_FILE}`);
}

/**
 * Abre (ou reutiliza) a janela administrativa do Painel Central.
 * O painel continua online; a janela apenas carrega a URL oficial.
 * Não altera login, senha, API ou permissões do painel.
 */
function openAdminWindow() {
  if (adminWindow && !adminWindow.isDestroyed()) {
    if (adminWindow.isMinimized()) adminWindow.restore();
    adminWindow.focus();
    return;
  }

  adminWindow = new BrowserWindow({
    title: 'Central Admin — MONIT.CAMPO',
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    center: true,
    show: false,
    backgroundColor: '#0B1018',
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(ICON_PATH),
    webPreferences: {
      // Sem preload privilegiado: o painel é origem externa e não deve
      // ter acesso a APIs do processo principal.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  adminWindow.once('ready-to-show', () => {
    adminWindow.show();
  });

  adminWindow.on('closed', () => {
    adminWindow = null;
  });

  // Mantém o título da janela administrativa
  adminWindow.on('page-title-updated', (e) => {
    e.preventDefault();
    adminWindow.setTitle('Central Admin — MONIT.CAMPO');
  });

  // Links externos do painel abrem no navegador padrão
  adminWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  adminWindow.loadURL(CENTRAL_ADMIN_URL);
}

// Instância única: evita duas janelas concorrendo pelo mesmo armazenamento local
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:toggle-maximize', () => {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    });
    ipcMain.on('window:close', () => mainWindow?.close());
    ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()));

    // Abre a janela administrativa do Painel Central (online)
    ipcMain.on('admin:open', () => openAdminWindow());

    /**
     * IDENTIDADE DA INSTALAÇÃO
     * O Installation ID é único e vive exclusivamente em
     * src/lib/access/local.ts (UUID persistente no armazenamento local).
     * O processo principal NÃO gera nem guarda identificador paralelo.
     */
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
