import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { bridge } from '../bridge'
import type { HistoryItem, Space } from '../types'
import { buildOmniboxSuggestions, type OmniboxSuggestionItem } from './omniboxSuggestions'

/** Address field with the address bar's suggestions (history, favorites, open tabs, search) — used on the new tab. */
export function useAddressSuggestions({ spaces, history, onNavigate }: { spaces: Space[]; history?: HistoryItem[]; onNavigate: (value: string, title?: string) => void }) {
  const [address, setAddress] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const root = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const query = address.trim()
    if (!query) { setSearchSuggestions([]); return }
    const timer = setTimeout(() => { bridge.fetchSuggestions?.(query).then(results => setSearchSuggestions(results || [])).catch(() => setSearchSuggestions([])) }, 150)
    return () => clearTimeout(timer)
  }, [address])
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setSelectedIndex(-1) } }
    window.addEventListener('pointerdown', outside, true)
    return () => window.removeEventListener('pointerdown', outside, true)
  }, [])
  const suggestions: OmniboxSuggestionItem[] = open && address.trim() ? buildOmniboxSuggestions({ query: address, spaces, history, googleSuggestions: searchSuggestions }) : []
  const select = (item: OmniboxSuggestionItem) => { setOpen(false); setSelectedIndex(-1); onNavigate(item.value, item.title) }
  const submit = () => {
    if (selectedIndex >= 0 && suggestions[selectedIndex]) return select(suggestions[selectedIndex])
    if (address.trim()) { setOpen(false); onNavigate(address.trim()) }
  }
  const change = (value: string) => { setAddress(value); setOpen(true); setSelectedIndex(-1) }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.nativeEvent.isComposing) { event.preventDefault(); return }
    if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setSelectedIndex(index => (index + 1) % suggestions.length) }
    if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setSelectedIndex(index => (index - 1 + suggestions.length) % suggestions.length) }
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); setSelectedIndex(-1) }
  }
  return { root, address, change, suggestions, selectedIndex, setSelectedIndex, select, submit, keyDown, open: () => setOpen(true) }
}
