import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import type { BrowserTab } from '../types'

export function TabIcon({ tab }: { tab: BrowserTab }) {
  const [failed, setFailed] = useState('')
  const favicon = tab.favicon && (/^https:\/\//i.test(tab.favicon) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(tab.favicon)) ? tab.favicon : ''
  return favicon && failed !== favicon ? <img className="tab-favicon" src={favicon} alt="" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(favicon)} /> : <Globe2 size={20} aria-hidden="true" />
}
