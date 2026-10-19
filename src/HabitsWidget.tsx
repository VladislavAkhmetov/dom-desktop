import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Check, Droplets, Eye, Heart, Plus, Sparkles, Trash2, Wind, X } from 'lucide-react'
import type { AppState, HabitItem, HabitsState } from './types'
import { sound } from './sound'

export function getTodayDateString(d = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const defaultHabitItems: HabitItem[] = [
  {
    id: 'water',
    title: 'Водный баланс',
    description: 'Стакан чистой воды для бодрости',
    kind: 'counter',
    targetCount: 8,
    currentCount: 0,
    unit: 'ст.'
  },
  {
    id: 'eyes',
    title: 'Отдых для глаз',
    description: '20 секунд вдаль каждые 20 минут',
    kind: 'checkbox',
    completedToday: false
  },
  {
    id: 'breath',
    title: 'Минута дыхания',
    description: 'Вдох 4с · Пауза 4с · Плавный выдох',
    kind: 'timer',
    timerMinutes: 1,
    completedToday: false
  },
  {
    id: 'posture',
    title: 'Разминка и осанка',
    description: 'Расправить плечи, мягко потянуться',
    kind: 'checkbox',
    completedToday: false
  }
]

export function resolveHabitsState(existing?: HabitsState, today = getTodayDateString()): HabitsState {
  if (!existing || !existing.items || existing.items.length === 0) {
    return {
      date: today,
      items: structuredClone(defaultHabitItems)
    }
  }

  // Если наступил новый день: сбрасываем прогресс, сохраняя все встроенные и пользовательские привычки
  if (existing.date !== today) {
    return {
      date: today,
      items: existing.items.map(item => ({
        ...item,
        currentCount: 0,
        completedToday: false
      }))
    }
  }

  return existing
}

export function HabitsWidget({
  state,
  onChange
}: {
  state: AppState
  onChange: (update: (state: AppState) => AppState) => void
}) {
  const today = getTodayDateString()
  const habitsState = useMemo(() => resolveHabitsState(state.habitsState, today), [state.habitsState, today])

  // Синхронизируем состояние при смене суток
  useEffect(() => {
    if (!state.habitsState || state.habitsState.date !== today) {
      onChange(prev => ({
        ...prev,
        habitsState: resolveHabitsState(prev.habitsState, today)
      }))
    }
  }, [state.habitsState?.date, today, onChange])

  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newKind, setNewKind] = useState<'checkbox' | 'counter'>('checkbox')
  const [newTarget, setNewTarget] = useState(3)

  // Интерактивный таймер дыхания
  const [breathActive, setBreathActive] = useState(false)
  const [breathRemaining, setBreathRemaining] = useState(60)
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!breathActive) {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current)
      return
    }

    breathIntervalRef.current = setInterval(() => {
      setBreathRemaining(prev => {
        if (prev <= 1) {
          // Минута завершена
          clearInterval(breathIntervalRef.current!)
          setBreathActive(false)
          sound.playWoodSnap('land')
          handleToggleHabit('breath', true)
          return 0
        }
        const next = prev - 1
        // Цикл 12 секунд: 4с вдох, 4с задержка, 4с выдох
        const cycleSecond = (60 - next) % 12
        if (cycleSecond < 4) {
          setBreathPhase('inhale')
        } else if (cycleSecond < 8) {
          setBreathPhase('hold')
        } else {
          if (cycleSecond === 8) {
            sound.playCalmExhale()
          }
          setBreathPhase('exhale')
        }
        return next
      })
    }, 1000)

    return () => {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current)
    }
  }, [breathActive])

  const updateHabits = (newItems: HabitItem[]) => {
    onChange(prev => ({
      ...prev,
      habitsState: {
        date: today,
        items: newItems
      }
    }))
  }

  const handleDrinkWater = (targetGlass?: number) => {
    sound.playWaterDrop()
    const nextItems = habitsState.items.map(item => {
      if (item.id === 'water') {
        const target = item.targetCount || 8
        const current = item.currentCount || 0
        let nextCount: number
        if (typeof targetGlass === 'number') {
          nextCount = current === targetGlass ? targetGlass - 1 : targetGlass
        } else {
          nextCount = Math.min(target, current + 1)
        }
        return {
          ...item,
          currentCount: nextCount,
          completedToday: nextCount >= target
        }
      }
      return item
    })
    updateHabits(nextItems)
  }

  const handleDecrementWater = (e: React.MouseEvent) => {
    e.stopPropagation()
    const waterItem = habitsState.items.find(i => i.id === 'water')
    if (!waterItem || (waterItem.currentCount || 0) <= 0) return
    sound.playWoodSnap('hover')
    const nextItems = habitsState.items.map(item => {
      if (item.id === 'water') {
        const nextCount = Math.max(0, (item.currentCount || 0) - 1)
        return {
          ...item,
          currentCount: nextCount,
          completedToday: nextCount >= (item.targetCount || 8)
        }
      }
      return item
    })
    updateHabits(nextItems)
  }

  const handleToggleHabit = (id: string, forceDone?: boolean) => {
    sound.playWoodSnap('land')
    const nextItems = habitsState.items.map(item => {
      if (item.id === id) {
        const nextDone = forceDone !== undefined ? forceDone : !item.completedToday
        return {
          ...item,
          completedToday: nextDone
        }
      }
      return item
    })
    updateHabits(nextItems)
  }

  const handleStepCounter = (id: string, delta: number) => {
    sound.playWoodSnap('land')
    const nextItems = habitsState.items.map(item => {
      if (item.id === id) {
        const target = item.targetCount || 1
        const current = item.currentCount || 0
        const next = Math.max(0, current + delta)
        return {
          ...item,
          currentCount: next,
          completedToday: next >= target
        }
      }
      return item
    })
    updateHabits(nextItems)
  }

  const handleAddCustomHabit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (!trimmed) return
    const newItem: HabitItem = {
      id: `custom-habit-${Date.now()}`,
      title: trimmed,
      kind: newKind,
      custom: true,
      completedToday: false,
      ...(newKind === 'counter' ? { targetCount: Math.max(1, newTarget), currentCount: 0 } : {})
    }
    updateHabits([...habitsState.items, newItem])
    setNewTitle('')
    setIsAdding(false)
  }

  const handleDeleteHabit = (id: string) => {
    sound.playWoodSnap('land')
    updateHabits(habitsState.items.filter(item => item.id !== id))
  }

  const completedCount = habitsState.items.filter(i => i.completedToday).length
  const totalCount = habitsState.items.length
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0
  const isAllCompleted = totalCount > 0 && completedCount === totalCount

  return (
    <div className="habits-widget" data-widget-type="habits">
      <div className="habits-header">
        <div className="habits-title-group">
          <div className="habits-title-wrap">
            <Heart size={16} className="habits-icon" />
            <h3 className="habits-title">Забота и привычки</h3>
          </div>
          <span className="habits-counter-pill" title="Выполнено сегодня">
            {completedCount} из {totalCount}
          </span>
        </div>

        <button
          type="button"
          className="habits-add-toggle-btn"
          onClick={() => setIsAdding(v => !v)}
          title="Добавить свой ритуал"
          aria-label="Добавить свой ритуал"
        >
          {isAdding ? <X size={15} /> : <Plus size={15} />}
        </button>
      </div>

      <div className="habits-progress-track" aria-hidden="true">
        <div
          className="habits-progress-fill"
          style={{ width: `${Math.round(progressRatio * 100)}%` }}
        />
      </div>

      {isAdding && (
        <form className="habits-add-form" onSubmit={handleAddCustomHabit}>
          <input
            autoFocus
            type="text"
            className="habits-input"
            placeholder="Название (напр. Витамин D, Прогулка…)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            maxLength={60}
          />
          <div className="habits-add-controls">
            <div className="habits-type-selector">
              <button
                type="button"
                className={`habits-type-btn ${newKind === 'checkbox' ? 'is-active' : ''}`}
                onClick={() => setNewKind('checkbox')}
              >
                Галочка
              </button>
              <button
                type="button"
                className={`habits-type-btn ${newKind === 'counter' ? 'is-active' : ''}`}
                onClick={() => setNewKind('counter')}
              >
                Счётчик
              </button>
            </div>

            {newKind === 'counter' && (
              <label className="habits-target-label">
                Цель:
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newTarget}
                  onChange={e => setNewTarget(Number(e.target.value) || 1)}
                  className="habits-target-input"
                />
              </label>
            )}

            <div className="habits-form-actions">
              <button
                type="button"
                className="habits-cancel-btn"
                onClick={() => setIsAdding(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="habits-submit-btn"
                disabled={!newTitle.trim()}
              >
                Добавить
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Интерактивный оверлей осознанного дыхания */}
      {breathActive && (
        <div className="habits-breath-overlay" role="region" aria-label="Дыхательное упражнение">
          <div className={`habits-breath-circle phase-${breathPhase}`}>
            <span className="breath-phase-text">
              {breathPhase === 'inhale' && 'Вдох…'}
              {breathPhase === 'hold' && 'Задержка'}
              {breathPhase === 'exhale' && 'Выдох…'}
            </span>
            <span className="breath-timer-text">{breathRemaining}с</span>
          </div>
          <div className="habits-breath-actions">
            <button
              type="button"
              className="habits-breath-done-btn"
              onClick={() => {
                setBreathActive(false)
                sound.playWoodSnap('land')
                handleToggleHabit('breath', true)
              }}
            >
              <Check size={14} /> Завершить сейчас
            </button>
            <button
              type="button"
              className="habits-breath-cancel-btn"
              onClick={() => setBreathActive(false)}
            >
              Остановить
            </button>
          </div>
        </div>
      )}

      <div className="habits-list">
        {habitsState.items.map(item => {
          if (item.id === 'water') {
            const target = item.targetCount || 8
            const current = item.currentCount || 0
            const isDone = item.completedToday || current >= target

            return (
              <div
                key={item.id}
                className={`habit-row habit-row-water ${isDone ? 'is-completed' : ''}`}
              >
                <div className="habit-info">
                  <div className="habit-title-row">
                    <Droplets size={15} className="habit-water-icon" />
                    <span className="habit-title">{item.title}</span>
                    <span className="habit-water-count">
                      {current} / {target} {item.unit || 'ст.'}
                    </span>
                  </div>
                  <span className="habit-description">{item.description}</span>
                </div>

                <div className="habit-water-glasses" role="group" aria-label="Стаканы воды">
                  {Array.from({ length: target }).map((_, idx) => {
                    const isGlassFilled = idx < current
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`habit-glass-btn ${isGlassFilled ? 'is-filled' : ''}`}
                        onClick={() => handleDrinkWater(idx + 1)}
                        title={`Стакан ${idx + 1}`}
                        aria-label={`Стакан воды ${idx + 1} из ${target}`}
                        aria-pressed={isGlassFilled}
                      >
                        <span className="glass-fill-indicator" />
                      </button>
                    )
                  })}
                  {current > 0 && (
                    <button
                      type="button"
                      className="habit-water-dec-btn"
                      onClick={handleDecrementWater}
                      title="Убрать один стакан"
                      aria-label="Убрать один стакан"
                    >
                      -1
                    </button>
                  )}
                </div>
              </div>
            )
          }

          if (item.kind === 'timer') {
            const isDone = Boolean(item.completedToday)
            return (
              <div
                key={item.id}
                className={`habit-row habit-row-timer ${isDone ? 'is-completed' : ''}`}
              >
                <div className="habit-info">
                  <div className="habit-title-row">
                    <Wind size={15} className="habit-kind-icon" />
                    <span className="habit-title">{item.title}</span>
                    {isDone && <span className="habit-done-badge">Сделано</span>}
                  </div>
                  <span className="habit-description">{item.description}</span>
                </div>

                <div className="habit-timer-actions">
                  <button
                    type="button"
                    className={`habit-breath-toggle-btn ${breathActive ? 'is-active' : ''}`}
                    onClick={() => {
                      if (breathActive) {
                        setBreathActive(false)
                      } else {
                        setBreathRemaining(60)
                        setBreathPhase('inhale')
                        setBreathActive(true)
                      }
                    }}
                    title={breathActive ? 'Остановить дыхание' : 'Запустить 1 минуту дыхания'}
                  >
                    <Wind size={14} />
                    <span>{breathActive ? 'Идёт...' : '1 мин'}</span>
                  </button>

                  <button
                    type="button"
                    className={`habit-check-btn ${isDone ? 'is-checked' : ''}`}
                    onClick={() => handleToggleHabit(item.id)}
                    aria-label={`Отметить ${item.title}`}
                    aria-pressed={isDone}
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            )
          }

          if (item.kind === 'counter') {
            const target = item.targetCount || 1
            const current = item.currentCount || 0
            const isDone = Boolean(item.completedToday) || current >= target

            return (
              <div
                key={item.id}
                className={`habit-row habit-row-counter ${isDone ? 'is-completed' : ''}`}
              >
                <div className="habit-info">
                  <div className="habit-title-row">
                    <Activity size={15} className="habit-kind-icon" />
                    <span className="habit-title">{item.title}</span>
                    <span className="habit-counter-badge">
                      {current} / {target}
                    </span>
                  </div>
                  {item.description && (
                    <span className="habit-description">{item.description}</span>
                  )}
                </div>

                <div className="habit-counter-actions">
                  <button
                    type="button"
                    className="habit-counter-btn"
                    onClick={() => handleStepCounter(item.id, -1)}
                    disabled={current <= 0}
                    title="Уменьшить"
                    aria-label="Уменьшить"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="habit-counter-btn habit-counter-plus"
                    onClick={() => handleStepCounter(item.id, 1)}
                    title="Увеличить"
                    aria-label="Увеличить"
                  >
                    +
                  </button>
                  {item.custom && (
                    <button
                      type="button"
                      className="habit-delete-btn"
                      onClick={() => handleDeleteHabit(item.id)}
                      title="Удалить привычку"
                      aria-label="Удалить привычку"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          }

          // Checkbox habit (eyes, posture, custom checkbox)
          const isDone = Boolean(item.completedToday)
          const isEyes = item.id === 'eyes'
          const isPosture = item.id === 'posture'

          return (
            <div
              key={item.id}
              className={`habit-row habit-row-checkbox ${isDone ? 'is-completed' : ''}`}
              onClick={() => handleToggleHabit(item.id)}
              role="checkbox"
              aria-checked={isDone}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  handleToggleHabit(item.id)
                }
              }}
            >
              <div className="habit-info">
                <div className="habit-title-row">
                  {isEyes && <Eye size={15} className="habit-kind-icon" />}
                  {isPosture && <Activity size={15} className="habit-kind-icon" />}
                  {!isEyes && !isPosture && <Sparkles size={15} className="habit-kind-icon" />}
                  <span className="habit-title">{item.title}</span>
                </div>
                {item.description && (
                  <span className="habit-description">{item.description}</span>
                )}
              </div>

              <div className="habit-checkbox-actions" onClick={e => e.stopPropagation()}>
                {item.custom && (
                  <button
                    type="button"
                    className="habit-delete-btn"
                    onClick={() => handleDeleteHabit(item.id)}
                    title="Удалить привычку"
                    aria-label="Удалить привычку"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className={`habit-check-btn ${isDone ? 'is-checked' : ''}`}
                  onClick={() => handleToggleHabit(item.id)}
                  aria-label={`Отметить ${item.title}`}
                  aria-pressed={isDone}
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {isAllCompleted && (
        <div className="habits-all-done-banner" role="status">
          <Sparkles size={15} className="banner-icon" />
          <span>День проведён с заботой о себе. Всё выполнено без спешки 🌱</span>
        </div>
      )}
    </div>
  )
}
