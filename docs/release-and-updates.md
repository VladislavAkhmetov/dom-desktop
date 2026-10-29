# Выпуски, обновления и движок Chromium

Документ описывает, как dombro собирается, публикуется и обновляется у пользователей. Код: [`electron/updates.cjs`](../electron/updates.cjs), [`electron-builder.json`](../electron-builder.json), [`.github/workflows`](../.github/workflows), [`.github/dependabot.yml`](../.github/dependabot.yml).

## Откуда берётся Chromium

Chromium приходит вместе с Electron (сейчас Electron 41). Отдельно движок не обновляется: новая версия Chromium = новая версия пакета `electron` + пересборка + выпуск. Electron поддерживает три последние мажорные версии, новая выходит примерно раз в 8 недель, исправления безопасности — в минорных версиях.

Поток обновления движка:

1. **Dependabot** (`.github/dependabot.yml`) каждый понедельник открывает PR с новыми `electron`, `electron-builder`, `electron-updater` (одной группой).
2. **CI** (`.github/workflows/ci.yml`, Windows) на PR выполняет `npm ci`, `npm run build`, `npm test` и нативные тесты `npm run test:cabinet-native`. Сливать PR можно только при зелёном CI.
3. После слияния поднимается `version` в `package.json` и ставится тег `vX.Y.Z` (см. ниже).

## Выпуск

1. Обновить `version` в `package.json` (и запасной текст `v…` в `electron/splash.html`, см. `AGENTS.md` §5).
2. `git tag vX.Y.Z && git push upstream vX.Y.Z`.
3. Workflow **Release** (`.github/workflows/release.yml`):
   * проверяет, что тег совпадает с `package.json`;
   * запускает unit- и нативные тесты;
   * `npm run dist -- --publish always` собирает NSIS-установщик и portable и загружает их вместе с `latest.yml` и `.blockmap` в **черновик** GitHub Release (`publish.releaseType: "draft"`).
4. Ответственный проверяет черновик и нажимает «Publish release». До этого обновление никому не приходит.

Постепенная раскатка: в опубликованный `latest.yml` можно добавить `stagingPercentage: 20` — `electron-updater` выдаст обновление только части установок. Потом поднять до 100.

## Как обновляется приложение

| Сборка | Механизм | Что видит пользователь |
|---|---|---|
| NSIS-установщик (`dombro-Setup-X.exe`) | `electron-updater`: тихая проверка через 10 с после запуска, фоновая загрузка (дифференциальная, по `.blockmap`), установка при выходе или по клику | Кнопка `[ ↑ vX.Y.Z ]` в правом верхнем углу возле профиля. При клике — поповер с информацией и кнопками «Перезапустить» (`bridge.installUpdate()`) или «При выходе» |
| Portable (`dombro-X-Portable.exe`) | `electron-updater` не умеет заменять portable-файл. Через 10 с dombro читает `GET /repos/VladislavAkhmetov/dombro-releases/releases/latest` и сравнивает версию | Кнопка `[ ↑ vX.Y.Z ]` возле профиля. При клике — «Скачать выпуск» (`bridge.openReleasePage()`) |

Правила, общие для обеих сборок:

* Пре-релизы и черновики не предлагаются (`allowPrerelease = false`, `isNewer()` пропускает `-beta` и т.п.), откат версии запрещён (`allowDowngrade = false`).
* Нет сети, лимит GitHub API, ошибка — молча, без сообщений (Calm Tech).
* Центральный «Островок внимания» остаётся чистым для дел, заметок и фокуса; индикатор обновления деликатно располагается в правом верхнем углу рядом с кнопкой профиля (`UpdateNoticeButton`).
* Адрес страницы выпуска собирается в главном процессе из фиксированного репозитория и проверенного тега. Интерфейс вызывает `app:open-release` без аргументов и не может подставить свою ссылку.
* Репозиторий указан в двух местах: `RELEASES` в `electron/updates.cjs` и `publish` в `electron-builder.json`. Тест `tests/updates.test.ts` следит, чтобы они совпадали.

**Приватные исходники и публичные релизы:**
Основной репозиторий с исходным кодом остаётся приватным. Готовые собранные бинарники загружаются в отдельный публичный репозиторий `VladislavAkhmetov/dombro-releases`, содержащий только раздел Releases и пустой README. Для сборки из приватного CI в секреты репозитория добавляется токен (`GH_TOKEN` с правами записи в `dombro-releases`).

## Защита собранного exe (Electron Fuses)

В `electron-builder.json → electronFuses` включены:

| Fuse | Значение | Зачем |
|---|---|---|
| `runAsNode` | `false` | `dombro.exe` нельзя запустить как обычный Node (`ELECTRON_RUN_AS_NODE`) |
| `enableNodeOptionsEnvironmentVariable` | `false` | Игнорируется `NODE_OPTIONS` (подгрузка чужого кода через переменную окружения) |
| `enableNodeCliInspectArguments` | `false` | Нельзя подключить отладчик через `--inspect` |
| `onlyLoadAppFromAsar` | `true` | Код приложения загружается только из `app.asar`, подложенная папка `app/` игнорируется |
| `enableEmbeddedAsarIntegrityValidation` | `true` | Изменённый `app.asar` не загрузится (Windows, Electron ≥ 30) |
| `enableCookieEncryption` | `true` | Cookies сайтов на диске шифруются ключом ОС, как в Chrome. Переход односторонний: выключать этот fuse потом нельзя |

Приложение само себя как Node не запускает (поток хранилища — `worker_threads`), поэтому `runAsNode: false` ничего не ломает. Тесты (`scripts/test-storage.cjs`) используют `ELECTRON_RUN_AS_NODE` с `electron` из `node_modules`, а не собранный exe, — fuses на них не влияют.

**Не проверено в этом окружении:** сборка exe и fuses требуют Windows-машины или CI. Первый прогон Release-workflow — проверка.

## Подпись кода

Сейчас сборки не подписаны. Последствия:

* Windows SmartScreen предупреждает при первом запуске.
* Целостность обновления держится на `sha512` из `latest.yml` того же выпуска, то есть на безопасности аккаунта GitHub. Обязательно: 2FA на аккаунте, публикация только через CI (не вручную с ноутбука).

Release-workflow уже передаёт `CSC_LINK` / `CSC_KEY_PASSWORD` из секретов `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`, если они заданы. Варианты сертификата — в [`prod-security-guide.md`](prod-security-guide.md) (Azure Trusted Signing, SignPath для open source). После получения подписи добавить `publisherName` в `publish` — тогда `electron-updater` будет проверять подпись скачанного обновления.
