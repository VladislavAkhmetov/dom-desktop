import { Bookmark, Globe2, History, Search, SquarePlus } from 'lucide-react'
import type { OmniboxSuggestionItem } from './omniboxSuggestions'

const BADGE: Record<OmniboxSuggestionItem['type'], string> = { search: 'Google', url: 'Сайт', tab: 'Вкладка', bookmark: 'Избранное', history: 'История' }

/** Suggestions of an address field — the same list under the address bar and under the new tab field. */
export function OmniboxSuggestionList({ items, selectedIndex, onSelect, onHover, className = '' }: {
  items: OmniboxSuggestionItem[]
  selectedIndex: number
  onSelect: (item: OmniboxSuggestionItem) => void
  onHover: (index: number) => void
  className?: string
}) {
  return <div className={`omnibox-dropdown ${className}`} role="listbox" aria-label="Подсказки адресной строки">
    {items.map((item, index) => {
      const isSelected = index === selectedIndex
      return <button key={item.id} type="button" role="option" aria-selected={isSelected} className={`omnibox-suggestion-item ${isSelected ? 'is-selected' : ''}`}
        onMouseDown={event => { event.preventDefault(); onSelect(item) }} onMouseEnter={() => onHover(index)}>
        <span className="omnibox-suggestion-icon" aria-hidden="true">
          {item.type === 'search' && <Search size={15} />}
          {item.type === 'url' && <Globe2 size={15} />}
          {item.type === 'tab' && <SquarePlus size={15} />}
          {item.type === 'bookmark' && <Bookmark size={15} />}
          {item.type === 'history' && <History size={15} />}
        </span>
        <span className="omnibox-suggestion-content">
          <span className="omnibox-suggestion-title">{item.title}</span>
          {item.subtitle && <span className="omnibox-suggestion-subtitle">{item.subtitle}</span>}
        </span>
        <span className="omnibox-suggestion-badge">{BADGE[item.type]}</span>
      </button>
    })}
  </div>
}
