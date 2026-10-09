import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Keep growing connection lists within the space available in the settings card. */
export function SettingsList<T extends { id: string }>({ items, label, empty, renderItem }: {
  items: T[]
  label: string
  empty: string
  renderItem: (item: T) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(3)
  useLayoutEffect(() => {
    const element = ref.current!
    const measure = () => {
      if (element.clientHeight) setPageSize(Math.max(1, Math.floor((element.clientHeight - 44) / 76)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const visiblePage = Math.min(page, pages - 1)
  return <div className="settings-list" ref={ref}>
    {items.length ? <div className="settings-list-items">{items.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize).map(item => <div className="settings-list-item" key={item.id}>{renderItem(item)}</div>)}</div> : <p className="settings-empty">{empty}</p>}
    {pages > 1 && <div className="settings-pagination" aria-label={label}>
      <span aria-live="polite">{visiblePage * pageSize + 1}–{Math.min((visiblePage + 1) * pageSize, items.length)} из {items.length}</span>
      <button className="calm-icon" aria-label={`Предыдущая страница: ${label}`} disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}><ChevronLeft size={17} /></button>
      <button className="calm-icon" aria-label={`Следующая страница: ${label}`} disabled={visiblePage === pages - 1} onClick={() => setPage(visiblePage + 1)}><ChevronRight size={17} /></button>
    </div>}
  </div>
}
