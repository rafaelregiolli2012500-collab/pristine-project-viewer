/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
// Preload mínimo e seguro: nenhuma API de Node é exposta ao renderer.
// Apenas canais IPC nominais para controlar a janela (sem acesso ao sistema).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monitCampo', {
  isDesktop: true,
  appName: 'MONIT.CAMPO',
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (cb) => {
    const handler = (_e, value) => cb(Boolean(value));
    ipcRenderer.on('window:maximized-changed', handler);
    return () => ipcRenderer.removeListener('window:maximized-changed', handler);
  },
  /** Abre a janela administrativa do Painel Central (online). */
  openAdminPanel: () => ipcRenderer.send('admin:open'),
});
