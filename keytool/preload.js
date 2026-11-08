const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('KT', {
  status: () => ipcRenderer.invoke('status'),
  generate: () => ipcRenderer.invoke('generate'),
  importKey: (b64) => ipcRenderer.invoke('import', b64),
  importFile: () => ipcRenderer.invoke('importFile'),
  issueSingle: (p) => ipcRenderer.invoke('issueSingle', p),
  issueMulti: (p) => ipcRenderer.invoke('issueMulti', p),
  log: () => ipcRenderer.invoke('log'),
  clearLog: () => ipcRenderer.invoke('clearLog'),
  copy: (t) => ipcRenderer.invoke('copy', t),
  exportPrivate: () => ipcRenderer.invoke('exportPrivate'),
});
