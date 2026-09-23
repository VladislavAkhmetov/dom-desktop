const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dom', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: state => ipcRenderer.invoke('state:save', state),
  pickResource: kind => ipcRenderer.invoke('resource:pick', kind),
  openResource: resource => ipcRenderer.invoke('resource:open', resource),
  getAutostart: () => ipcRenderer.invoke('settings:getAutostart'),
  setAutostart: value => ipcRenderer.invoke('settings:setAutostart', value),
  fetchCalendar: url => ipcRenderer.invoke('calendar:fetch', url),
  onFocusCapture: callback => {
    const listener = () => callback()
    ipcRenderer.on('focus:capture', listener)
    return () => ipcRenderer.removeListener('focus:capture', listener)
  },
  onStateChanged: callback => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  }
})
