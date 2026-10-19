const { contextBridge, ipcRenderer } = require('electron')

const isCabinetPilot =
  !process.argv.includes('--legacy-pilot') &&
  (typeof window === 'undefined' || !window.location.search.includes('cabinet=0'))

contextBridge.exposeInMainWorld('dom', {
  platform: process.platform,
  cabinetPilot: isCabinetPilot,
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: state => ipcRenderer.invoke('state:save', state),
  applyChanges: changes => ipcRenderer.invoke('state:apply', changes),
  search: query => ipcRenderer.invoke('state:search', query),
  backup: () => ipcRenderer.invoke('state:backup'),
  closeCapture: () => ipcRenderer.invoke('capture:close'),
  integrations: {
    configureGoogle: value => ipcRenderer.invoke('google:configure', value),
    googleConfigured: () => ipcRenderer.invoke('google:configured'),
    connectMail: () => ipcRenderer.invoke('gmail:connect'),
    syncMail: id => ipcRenderer.invoke('gmail:sync', id),
    disconnectMail: id => ipcRenderer.invoke('gmail:disconnect', id),
    fetchFeed: url => ipcRenderer.invoke('feed:fetch', url),
    readMaterial: id => ipcRenderer.invoke('material:read', id),
    addCalendar: (name, url) => ipcRenderer.invoke('calendar:add', name, url),
    fetchCalendarSource: id => ipcRenderer.invoke('calendar:source', id),
    removeCalendar: id => ipcRenderer.invoke('calendar:remove', id),
    configureAI: (value, key) => ipcRenderer.invoke('ai:configure', value, key),
    runAI: request => ipcRenderer.invoke('ai:run', request),
    cancelAI: id => ipcRenderer.invoke('ai:cancel', id),
    transcribeAudio: (buffer, mimeType) => ipcRenderer.invoke('ai:transcribe', buffer, mimeType),
    onAI: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('ai:event', listener); return () => ipcRenderer.removeListener('ai:event', listener) }
  },
  vault: {
    listCredentials: origin => ipcRenderer.invoke('vault:credentials:list', origin),
    saveCredential: cred => ipcRenderer.invoke('vault:credentials:save', cred),
    removeCredential: id => ipcRenderer.invoke('vault:credentials:remove', id),
    importCredentials: csv => ipcRenderer.invoke('vault:credentials:import', csv)
  },
  browser: {
    show: value => ipcRenderer.invoke('browser:show', value),
    hide: id => ipcRenderer.invoke('browser:hide', id),
    move: (id, spaceId) => ipcRenderer.invoke('browser:move', id, spaceId),
    block: value => ipcRenderer.invoke('browser:block', value),
    close: id => ipcRenderer.invoke('browser:close', id),
    park: ids => ipcRenderer.invoke('browser:park', ids),
    action: (id, action) => ipcRenderer.invoke('browser:action', id, action),
    text: id => ipcRenderer.invoke('browser:text', id),
    respondPermission: (id, allowed) => ipcRenderer.invoke('browser:respondPermission', id, allowed),
    onEvent: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('browser:event', listener); return () => ipcRenderer.removeListener('browser:event', listener) },
    getAdblockStatus: (tabId, hostname) => ipcRenderer.invoke('browser:adblock:status', tabId, hostname),
    toggleAdblockSite: (hostname, disabled) => ipcRenderer.invoke('browser:adblock:toggle-site', hostname, disabled),
    toggleAdblockCookies: enabled => ipcRenderer.invoke('browser:adblock:toggle-cookies', enabled),
    toggleAdblockGlobal: enabled => ipcRenderer.invoke('browser:adblock:toggle-global', enabled),
    toggleDarkSite: (tabId, hostname, enabled) => ipcRenderer.invoke('browser:dark:toggle', tabId, hostname, enabled),
    getReaderContent: tabId => ipcRenderer.invoke('browser:reader:content', tabId),
    translateText: (text, targetLang) => ipcRenderer.invoke('browser:translate:text', text, targetLang),
    translateTab: tabId => ipcRenderer.invoke('browser:translate:tab', tabId)
  },
  pickResource: kind => ipcRenderer.invoke('resource:pick', kind),
  openResource: resource => ipcRenderer.invoke('resource:open', resource),
  osWindows: {
    listOpen: () => ipcRenderer.invoke('windows:list-open'),
    minimize: (toPark, activeKeep) => ipcRenderer.invoke('windows:minimize', toPark, activeKeep),
    restore: (hwndList, focusDomWindow) => ipcRenderer.invoke('windows:restore', hwndList, focusDomWindow),
    focus: hwnd => ipcRenderer.invoke('windows:focus', hwnd)
  },
  getAutostart: () => ipcRenderer.invoke('settings:getAutostart'),
  setAutostart: value => ipcRenderer.invoke('settings:setAutostart', value),
  fetchCalendar: url => ipcRenderer.invoke('calendar:fetch', url),
  fetchSuggestions: query => ipcRenderer.invoke('browser:suggest', query),
  toggleFullScreen: () => ipcRenderer.invoke('window:toggleFullScreen'),
  isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),
  onFocusCapture: callback => {
    const listener = () => callback()
    ipcRenderer.on('focus:capture', listener)
    return () => ipcRenderer.removeListener('focus:capture', listener)
  },
  onVoiceToggle: callback => {
    const listener = () => callback()
    ipcRenderer.on('capture:toggle-voice', listener)
    return () => ipcRenderer.removeListener('capture:toggle-voice', listener)
  },
  getRecentFiles: () => ipcRenderer.invoke('resource:recentFiles'),
  onToast: callback => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('toast:show', listener)
    return () => ipcRenderer.removeListener('toast:show', listener)
  },
  onStateChanged: callback => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  }
})
