const { contextBridge, ipcRenderer } = require('electron')
const op = (name, a, b) => ipcRenderer.invoke('shell:op', name, a, b)
contextBridge.exposeInMainWorld('shell', Object.freeze({
  state: () => op('state'), activate: id => op('activate', id), setView: (id, view) => op('setView', id, view), editDoc: id => op('editDoc', id), closeDoc: id => op('closeDoc', id),
  detach: id => op('detach', id), crashPanel: id => op('crashPanel', id), closePanel: id => op('closePanel', id), rawPanelOp: envelope => op('rawPanelOp', envelope),
  resolveClose: choice => op('resolveClose', choice), requestClose: () => op('requestClose'), layout: (action, value) => op('layout', action, value),
  onEvent: cb => ipcRenderer.on('shell:event', (_e, evt) => cb(evt))
}))
