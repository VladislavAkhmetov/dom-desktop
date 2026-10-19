const path = require('node:path')

if (process.platform !== 'win32') {
  module.exports = {
    getOpenWindows: () => [],
    minimizeWindows: () => {},
    restoreWindows: () => {},
    isWindowAlive: () => false,
    focusWindow: () => false
  }
} else {
  const koffi = require('koffi')
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  const dwmapi = koffi.load('dwmapi.dll')

  const RECT = koffi.struct('RECT', {
    left: 'long',
    top: 'long',
    right: 'long',
    bottom: 'long'
  })

  const WNDENUMPROC = koffi.proto('bool WNDENUMPROC(void *hwnd, intptr_t lParam)')
  const EnumWindows = user32.func('bool EnumWindows(WNDENUMPROC *lpEnumFunc, intptr_t lParam)')
  const EnumDesktopWindows = user32.func('bool EnumDesktopWindows(void *hDesktop, WNDENUMPROC *lpfn, intptr_t lParam)')
  const OpenDesktopW = user32.func('void * OpenDesktopW(str16 lpszDesktop, uint32_t dwFlags, bool fInherit, uint32_t dwDesiredAccess)')
  const CloseDesktop = user32.func('bool CloseDesktop(void *hDesktop)')

  const SetThreadDesktop = user32.func('bool SetThreadDesktop(void *hDesktop)')

  const IsWindow = user32.func('bool IsWindow(void *hwnd)')
  const IsWindowVisible = user32.func('bool IsWindowVisible(void *hwnd)')
  const IsIconic = user32.func('bool IsIconic(void *hwnd)')
  const GetWindowTextW = user32.func('int GetWindowTextW(void *hwnd, uint16_t *lpString, int nMaxCount)')
  const GetWindowLongW = user32.func('int GetWindowLongW(void *hwnd, int nIndex)')
  const GetWindowRect = user32.func('bool GetWindowRect(void *hwnd, _Out_ RECT *lpRect)')
  const GetWindowThreadProcessId = user32.func('uint32_t GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *lpdwProcessId)')
  const ShowWindow = user32.func('bool ShowWindow(void *hwnd, int nCmdShow)')
  const SetForegroundWindow = user32.func('bool SetForegroundWindow(void *hwnd)')

  const DwmGetWindowAttribute = dwmapi.func('int DwmGetWindowAttribute(void *hwnd, uint32_t dwAttribute, _Out_ uint32_t *pvAttribute, uint32_t cbAttribute)')
  const OpenProcess = kernel32.func('void * OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)')
  const QueryFullProcessImageNameW = kernel32.func('bool QueryFullProcessImageNameW(void *hProcess, uint32_t dwFlags, _Out_ uint16_t *lpExeName, _Inout_ uint32_t *lpdwSize)')
  const CloseHandle = kernel32.func('bool CloseHandle(void *hObject)')

  const GWL_EXSTYLE = -20
  const WS_EX_TOOLWINDOW = 0x00000080
  const WS_EX_APPWINDOW = 0x00040000
  const DWMWA_CLOAKED = 14
  const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
  const SW_MINIMIZE = 6
  const SW_RESTORE = 9

  let desktopEnsured = false
  function ensureThreadDesktop() {
    if (desktopEnsured) return true
    try {
      const hDesk = OpenDesktopW('default', 0, false, 0x01ff)
      if (hDesk) {
        SetThreadDesktop(hDesk)
        desktopEnsured = true
        return true
      }
    } catch {
      // fallback
    }
    return false
  }

  function toBigIntHwnd(val) {
    if (typeof val === 'bigint') return val
    if (typeof val === 'number') return BigInt(val)
    if (typeof val === 'string') {
      try { return BigInt(val) } catch { return null }
    }
    return null
  }

  function isWindowAlive(hwnd) {
    ensureThreadDesktop()
    const raw = toBigIntHwnd(hwnd)
    return Boolean(raw && IsWindow(raw))
  }

  function getOpenWindows(excludePid = process.pid) {
    ensureThreadDesktop()
    const windows = []

    const callback = koffi.register((hwnd) => {
      if (!IsWindowVisible(hwnd)) return true

      const pidOut = [0]
      GetWindowThreadProcessId(hwnd, pidOut)
      const pid = pidOut[0]
      if (!pid || (excludePid && pid === excludePid)) return true

      // 1. Отсекаем DWM Cloaked (фоновые UWP и виртуальные столы)
      const cloakedOut = [0]
      if (DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakedOut, 4) === 0 && cloakedOut[0] !== 0) {
        return true
      }

      // 2. Отсекаем служебные тулбары и панели
      const exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE)
      if ((exStyle & WS_EX_TOOLWINDOW) !== 0 && (exStyle & WS_EX_APPWINDOW) === 0) {
        return true
      }

      // 3. Проверяем геометрию окна
      if (!IsIconic(hwnd)) {
        const rect = {}
        if (GetWindowRect(hwnd, rect)) {
          if (rect.right - rect.left <= 0 || rect.bottom - rect.top <= 0) return true
        }
      }

      // 4. Заголовок окна
      const titleBuf = Buffer.alloc(1024)
      const len = GetWindowTextW(hwnd, titleBuf, 512)
      if (len <= 0) return true
      const title = titleBuf.toString('utf16le', 0, len * 2).trim()
      if (!title || title === 'Program Manager') return true

      // 5. Исполняемый файл
      const hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
      if (!hProcess) return true

      let exePath = null
      try {
        const buffer = Buffer.alloc(2048)
        const sizeInOut = [1024]
        const ok = QueryFullProcessImageNameW(hProcess, 0, buffer, sizeInOut)
        if (ok && sizeInOut[0] > 0) {
          exePath = buffer.toString('utf16le', 0, sizeInOut[0] * 2)
        }
      } catch {
        // ignore
      } finally {
        CloseHandle(hProcess)
      }

      if (!exePath) return true

      const exeName = path.basename(exePath)
      const lowerExe = exeName.toLowerCase()
      if (lowerExe === 'applicationframehost.exe' || exePath.toLowerCase().includes('dombro')) {
        return true
      }

      const hwndStr = '0x' + BigInt(hwnd).toString(16)
      windows.push({
        hwnd: hwndStr,
        title,
        exeName,
        exePath,
        isMinimized: Boolean(IsIconic(hwnd))
      })

      return true
    }, koffi.pointer(WNDENUMPROC))

    // В среде Electron или изолированных десктопах пробуем десктоп 'default', иначе EnumWindows
    let enumerated = false
    try {
      const hDesk = OpenDesktopW('default', 0, false, 0x0041)
      if (hDesk) {
        enumerated = EnumDesktopWindows(hDesk, callback, 0)
        CloseDesktop(hDesk)
      }
    } catch {
      // fallback
    }

    if (!enumerated) {
      EnumWindows(callback, 0)
    }

    koffi.unregister(callback)
    return windows
  }

  function minimizeWindows(hwndListToPark, activeTargetHwndList = []) {
    ensureThreadDesktop()
    const keepSet = new Set((activeTargetHwndList || []).map(item => String(item).toLowerCase()))
    for (const addr of hwndListToPark || []) {
      if (!addr || keepSet.has(String(addr).toLowerCase())) continue
      const raw = toBigIntHwnd(addr)
      if (raw && IsWindow(raw) && IsWindowVisible(raw) && !IsIconic(raw)) {
        ShowWindow(raw, SW_MINIMIZE)
      }
    }
  }

  function restoreWindows(hwndList, focusDomWindowHwnd = null) {
    ensureThreadDesktop()
    let lastValidRaw = null
    for (const addr of hwndList || []) {
      if (!addr) continue
      const raw = toBigIntHwnd(addr)
      if (raw && IsWindow(raw)) {
        if (IsIconic(raw)) {
          ShowWindow(raw, SW_RESTORE)
        }
        lastValidRaw = raw
      }
    }

    const focusRaw = toBigIntHwnd(focusDomWindowHwnd)
    if (focusRaw && IsWindow(focusRaw)) {
      SetForegroundWindow(focusRaw)
    } else if (lastValidRaw) {
      SetForegroundWindow(lastValidRaw)
    }
  }

  function focusWindow(hwnd) {
    ensureThreadDesktop()
    const raw = toBigIntHwnd(hwnd)
    if (raw && IsWindow(raw)) {
      if (IsIconic(raw)) {
        ShowWindow(raw, SW_RESTORE)
      }
      SetForegroundWindow(raw)
      return true
    }
    return false
  }

  module.exports = {
    getOpenWindows,
    minimizeWindows,
    restoreWindows,
    isWindowAlive,
    focusWindow
  }
}
