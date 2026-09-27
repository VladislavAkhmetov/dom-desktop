import { Dialog } from './Dialog'
import type { AppState, Space } from './types'
export function ChangesOverview({ state, space, onClose }: { state: AppState; space: Space; onClose: () => void }) {
  const checkpoint = space.checkpoint
  const previous = new Set(checkpoint?.session?.tabs.map(item => item.url).filter(Boolean))
  const current = new Set(space.activeSession?.tabs.map(item => item.url).filter(Boolean))
  const added = [...current].filter(url => !previous.has(url)), removed = [...previous].filter(url => !current.has(url))
  const since = checkpoint?.savedAt ? Date.parse(checkpoint.savedAt) : 0
  const letters = state.mailMessages?.filter(item => item.important && Date.parse(item.receivedAt) > since) || []
  return <Dialog title={`После сохранения «${space.name}»`} onClose={onClose}><p>{checkpoint ? new Date(checkpoint.savedAt).toLocaleString('ru-RU') : 'Сохранения ещё не было.'}</p>{checkpoint?.nextStep && <p>Следующий шаг: {checkpoint.nextStep}</p>}<div className="calm-digest-list">{added.map(url => <p key={url}>Добавлена вкладка: {url}</p>)}{removed.map(url => <p key={url}>Убрана вкладка: {url}</p>)}{letters.slice(0, 10).map(item => <p key={item.id}>Важное письмо: {item.subject} · {item.from}</p>)}{!added.length && !removed.length && !letters.length && <p>Вкладки и важные письма не изменились.</p>}</div></Dialog>
}
