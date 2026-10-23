// Проверено 22 октября 2026: официальный browser-v2026.10.0,
// архив dist-chrome-2026.10.0.zip. Electron 41 принимает каталог,
// затем service worker завершается: нет chrome.webNavigation
// (код регистрации 15). Заглушка onCommitted доходит до
// chrome.notifications и getAllFrames. На форме входа интерфейса
// Bitwarden нет. Id — хеш каталога, не id магазина Chrome, поэтому
// native messaging с настольным приложением не соединяется.
// При старте архив не скачивается.
const PIN = {
  version: '2026.10.0',
  url: 'https://github.com/bitwarden/clients/releases/download/browser-v2026.10.0/dist-chrome-2026.10.0.zip',
  sha256: '7b9ec650b87dd8975e87a0e0bdd0c1f1a0fcf5b0a8da5ae759ec14cdffaad35d'
}

function bitwardenExtensionStatus() {
  return {
    loaded: false,
    version: PIN.version,
    worker: false,
    error: 'Официальный Bitwarden 2026.10.0 в этом Electron не запускается: фоновому процессу нужны chrome.webNavigation и уведомления. Строки «Сохранить пароль?» не будет.'
  }
}

module.exports = { PIN, bitwardenExtensionStatus }
