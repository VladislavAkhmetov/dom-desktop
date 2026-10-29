import { Database, HardDrive, Lock, ShieldCheck } from 'lucide-react'

export function PrivacySettings() {
  return (
    <div className="settings-columns">
      <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={26} color="var(--accent)" />
          <h4 style={{ margin: 0, color: 'var(--ink-1)' }}>Принцип Local-First</h4>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--ink-1)', lineHeight: 1.55 }}>
          «Дом» создан по архитектуре <strong>Local-First</strong>. Это означает, что хозяин ваших данных — исключительно вы.
        </p>

        <div style={{ display: 'grid', gap: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <HardDrive size={18} color="var(--ink-2)" style={{ flex: 'none', marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-1)', display: 'block' }}>Хранение на вашем устройстве</strong>
              <small style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.4, display: 'block' }}>
                Вся история просмотров, открытые вкладки, пространства, дела и черновики хранятся в локальной базе данных SQLite на вашем диске.
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Lock size={18} color="var(--ink-2)" style={{ flex: 'none', marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-1)', display: 'block' }}>Аппаратное шифрование секретов</strong>
              <small style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.4, display: 'block' }}>
                Пароли и ключи ИИ шифруются встроенными средствами операционной системы (DPAPI на Windows и Apple Keychain на macOS) и недоступны другим программам.
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Database size={18} color="var(--ink-2)" style={{ flex: 'none', marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-1)', display: 'block' }}>Никаких скрытых облачных серверов</strong>
              <small style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.4, display: 'block' }}>
                Приложение не отправляет ваши персональные данные, историю серфинга или файлы на внешние серверы аналитики.
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h4 style={{ margin: 0, color: 'var(--ink-1)' }}>Условия использования и безопасность</h4>
        <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--ink-2)', lineHeight: 1.5 }}>
          Приложение распространяется на условиях «как есть» (AS IS). Разработчик не несёт ответственности за действия сторонних веб-сайтов, открываемых через встроенный браузер.
        </p>

        <div style={{ padding: 12, background: 'var(--surface-control)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-soft)' }}>
          <strong style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-1)', display: 'block', marginBottom: 4 }}>Безопасность браузера</strong>
          <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.45 }}>
            Веб-страницы изолированы в песочнице Chromium (Sandbox и Context Isolation). Прямой доступ сайтов к файловой системе компьютера и Node.js категорически заблокирован.
          </p>
        </div>
      </div>
    </div>
  )
}
