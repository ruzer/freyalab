// Preload de la ventana secundaria: superficie mínima. Sin acceso a archivos, a la ventana principal ni a otras operaciones.
const { contextBridge, ipcRenderer } = require('electron')
const identity = ipcRenderer.sendSync('panel:whoami')
const call = (op, payload = {}, extra = {}) => ipcRenderer.invoke('panel:op', { v: 1, windowId: identity?.windowId, docId: identity?.docId, op, payload, ...extra })
contextBridge.exposeInMainWorld('panel', Object.freeze({
  identity: Object.freeze({ ...identity }),
  hello: () => call('hello'),
  getView: () => call('getView'),
  run: (payload, requestId = crypto.randomUUID(), revision) => call('run', payload, { requestId, ...revision === undefined ? {} : { revision } }),
  cancel: requestId => call('cancel', { requestId }),
  reattach: () => call('reattach'),
  close: () => call('close'),
  onEvent: cb => { const listener = (_e, evt) => cb(evt); ipcRenderer.on('panel:event', listener); return () => ipcRenderer.removeListener('panel:event', listener) },
  // Solo para las pruebas del spike: permite enviar sobres manipulados para comprobar que main los rechaza.
  __raw: envelope => ipcRenderer.invoke('panel:op', envelope)
}))
