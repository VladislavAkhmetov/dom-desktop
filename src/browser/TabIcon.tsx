import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import type { BrowserTab } from '../types'
import { SiteMark } from '../FileTypeBadge'

// Favicon when the page supplied one; otherwise the same local domain monogram the space page uses.
export function TabIcon({ tab }: { tab: BrowserTab }) {
  const [failed, setFailed] = useState('')
  const favicon = tab.favicon && (/^https:\/\//i.test(tab.favicon) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(tab.favicon)) ? tab.favicon : ''
  // A blank new tab has no site yet: a neutral globe instead of the monogram of «Новая вкладка».
  if (!tab.url) return <Globe2 className="tab-blank-icon" size={18} aria-hidden="true" />
  return favicon && failed !== favicon ? <img className="tab-favicon" src={favicon} alt="" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(favicon)} /> : <SiteMark className="tab-site-mark" url={tab.url} title={tab.title} />
}
