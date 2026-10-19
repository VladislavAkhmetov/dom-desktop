import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Mic } from 'lucide-react'
import { Dialog } from './Dialog'
import { CaptureSchedule } from './CaptureSchedule'
import { fromLocalInput, toLocalInput, parseCapture } from './reminders'
import { planTime } from './dayModel'
import { localDate } from '../shared/state'
import { useVoiceCapture } from './voice'
import { bridge } from './bridge'
import './capture.css'

interface Props {
  initialWhen: string
  initialReminderAt?: string
  onClose: () => void
  onSave: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
}

function readDraft() {
  try {
    const value = JSON.parse(sessionStorage.getItem('dom-capture-details') || 'null')
    if (!value || typeof value.raw !== 'string') return null
    const startedAt = typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt)) ? value.startedAt : new Date().toISOString()
    const previous = parseCapture(value.raw, new Date(startedAt))
    // Bring a title edited in the old details form back into the visible text field.
    const legacyTitle = typeof value.manualTitle === 'string' ? value.manualTitle : undefined
    return {
      raw: legacyTitle ?? value.raw as string,
      manualDay: typeof value.manualDay === 'string' ? value.manualDay : legacyTitle !== undefined ? previous.plannedDate ?? undefined : undefined,
      manualWhen: typeof value.manualWhen === 'string' ? value.manualWhen : legacyTitle !== undefined ? toLocalInput(previous.dueAt) : undefined,
      defaultDay: typeof value.defaultDay === 'string' ? value.defaultDay : '',
      startedAt,
    }
  } catch { return null }
}

export function Capture({ initialWhen, initialReminderAt, onClose, onSave }: Props) {
  const [draft] = useState(readDraft)
  const [raw, setRaw] = useState(() => draft?.raw ?? sessionStorage.getItem('dom-capture-draft') ?? '')
  const [manualDay, setManualDay] = useState<string | undefined>(initialWhen ? undefined : draft?.manualDay)
  const [manualWhen, setManualWhen] = useState<string | undefined>(initialReminderAt ?? (initialWhen ? undefined : draft?.manualWhen))
  const [defaultDay] = useState(() => initialWhen.split('T')[0] || (draft?.raw.trim() ? draft.defaultDay : ''))
  const [picker, setPicker] = useState<'date' | 'reminder' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const startedAt = useRef(draft ? new Date(draft.startedAt) : new Date())
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scheduleRef = useRef<HTMLDivElement>(null)
  const parsed = parseCapture(raw, startedAt.current)
  const title = parsed.title
  const plannedDate = (manualDay ?? parsed.plannedDate ?? defaultDay) || null
  const dueAt = manualWhen !== undefined ? fromLocalInput(manualWhen)
    : manualDay && parsed.dueAt ? fromLocalInput(`${manualDay}T${toLocalInput(parsed.dueAt).slice(11)}`) : parsed.dueAt
  const pastReminder = Boolean(dueAt && Date.parse(dueAt) <= Date.now())

  useEffect(() => {
    sessionStorage.setItem('dom-capture-draft', raw)
    sessionStorage.setItem('dom-capture-details', JSON.stringify({ raw, manualDay, manualWhen, defaultDay, startedAt: startedAt.current.toISOString() }))
  }, [raw, manualDay, manualWhen, defaultDay])

  const closePicker = useCallback((restoreFocus = true) => {
    if (restoreFocus) scheduleRef.current?.querySelector<HTMLButtonElement>(`[data-picker="${picker}"]`)?.focus()
    setPicker(null)
  }, [picker])

  function chooseDay(day: string | null) {
    setManualDay(day || '')
    if (day && dueAt) setManualWhen(`${day}T${toLocalInput(dueAt).slice(11)}`)
    setSaveError('')
  }

  function chooseReminder(value: string) {
    setManualWhen(value)
    if (value && !plannedDate) setManualDay(value.split('T')[0])
    setSaveError('')
  }

  const {
    status: voiceStatus,
    toggle: toggleVoice,
    isSupported: isVoiceSupported
  } = useVoiceCapture({
    onTranscribed: text => {
      if (text.trim()) {
        const next = raw.trim() ? `${raw.trim()} ${text.trim()}` : text.trim()
        setRaw(next)
        startedAt.current = new Date()
        setSaveError('')
        inputRef.current?.focus()
      }
    },
    onError: err => {
      setSaveError(err)
    }
  })

  useEffect(() => {
    return bridge.onVoiceToggle?.(() => {
      toggleVoice()
    })
  }, [toggleVoice])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === ' ' || event.code === 'Space')) {
        event.preventDefault()
        toggleVoice()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleVoice])

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const voiceShortcutLabel = isMac ? 'Cmd + Shift + Space' : 'Ctrl + Shift + Space'

  async function save() {
    if (!title.trim() || saving) return
    if (dueAt && Date.parse(dueAt) <= Date.now()) { setSaveError('Время напоминания уже прошло.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const result = await onSave(title.trim(), dueAt, plannedDate, plannedDate || dueAt ? 'task' : 'note')
      if (result !== false) {
        sessionStorage.removeItem('dom-capture-draft')
        sessionStorage.removeItem('dom-capture-details')
      } else setSaveError('Не удалось сохранить')
    } catch { setSaveError('Не удалось сохранить') }
    finally { setSaving(false) }
  }

  return <Dialog className="capture-dialog" title={plannedDate || dueAt ? 'Новое дело' : 'Новая запись'} onClose={onClose} onEscape={() => picker ? closePicker() : onClose()}>
    <div className="calm-form capture-simple">
      <div className="capture-textarea-wrap">
        <label className="visually-hidden" htmlFor="quick-thought">Мысль или дело</label>
        <textarea
          id="quick-thought"
          ref={inputRef}
          rows={3}
          value={raw}
          placeholder={voiceStatus === 'listening' ? 'Слушаю… Назовите дело или напоминание' : plannedDate ? 'Что нужно сделать?' : 'Что хотите записать?'}
          onChange={event => {
            const next = event.target.value
            if (!raw && next) startedAt.current = new Date()
            setRaw(next)
            setSaveError('')
          }}
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void save()
            }
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === ' ' || event.code === 'Space' || event.key === 'v' || event.key === 'V')) {
              event.preventDefault()
              toggleVoice()
            }
          }}
        />
        {isVoiceSupported && (
          <button
            type="button"
            className={`capture-voice-button ${voiceStatus === 'listening' ? 'listening' : ''} ${voiceStatus === 'transcribing' ? 'transcribing' : ''}`}
            onClick={toggleVoice}
            title={voiceStatus === 'listening' ? `Завершить запись · ${voiceShortcutLabel}` : `Голосовой ввод · ${voiceShortcutLabel}`}
            aria-label={voiceStatus === 'listening' ? 'Остановить запись голоса' : 'Начать голосовой ввод'}
            aria-pressed={voiceStatus === 'listening'}
            disabled={saving || voiceStatus === 'transcribing'}
          >
            {voiceStatus === 'listening' && <span className="voice-pulse" aria-hidden="true" />}
            <Mic size={18} />
          </button>
        )}
      </div>
      {voiceStatus === 'listening' && (
        <div className="capture-voice-badge listening" role="status">
          <span className="voice-pulse-dot" aria-hidden="true" />
          <span>Слушаю… Нажмите {voiceShortcutLabel} для завершения</span>
        </div>
      )}
      {voiceStatus === 'transcribing' && (
        <div className="capture-voice-badge transcribing" role="status">
          <span>Распознаём запись…</span>
        </div>
      )}
    </div>
    <div className="capture-options" aria-label="Тип записи и день выполнения">
      <button disabled={saving} aria-pressed={!plannedDate && !dueAt} onClick={() => { setManualDay(''); setManualWhen(''); setRaw(title); closePicker(false) }}>Запись</button>
      <button disabled={saving} aria-pressed={plannedDate === localDate(planTime(0))} onClick={() => { chooseDay(localDate(planTime(0))); closePicker(false) }}>Сегодня</button>
      <button disabled={saving} aria-pressed={plannedDate === localDate(planTime(1))} onClick={() => { chooseDay(localDate(planTime(1))); closePicker(false) }}>Завтра</button>
    </div>
    <div ref={scheduleRef}><CaptureSchedule plannedDate={plannedDate} dueAt={dueAt} picker={picker} disabled={saving} onPicker={setPicker} onClosePicker={closePicker} onDay={chooseDay} onReminder={chooseReminder} /></div>
    {pastReminder && <p className="capture-error" role="alert">Время напоминания уже прошло</p>}
    {!pastReminder && saveError && <p className="capture-error" role="alert">{saveError}</p>}
    <div className="calm-dialog-actions"><button className="calm-primary" onClick={() => void save()} disabled={!title.trim() || saving || pastReminder} title="Сохранить · Ctrl + Enter">{saving ? 'Сохраняем…' : 'Сохранить'} <ArrowRight size={17} /></button></div>
  </Dialog>
}
