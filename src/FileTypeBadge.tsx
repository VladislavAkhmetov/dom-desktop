import { FileText } from 'lucide-react'

// Recognizable app marks for common work files; falls back to a neutral document icon.
const fileBadges: Record<string, { label: string; bg: string; fg: string }> = {
  psd: { label: 'Ps', bg: '#001e36', fg: '#31a8ff' },
  ai: { label: 'Ai', bg: '#330000', fg: '#ff9a00' },
  xlsx: { label: 'X', bg: '#1d6f42', fg: '#ffffff' },
  xls: { label: 'X', bg: '#1d6f42', fg: '#ffffff' },
  csv: { label: 'X', bg: '#1d6f42', fg: '#ffffff' },
  docx: { label: 'W', bg: '#2b579a', fg: '#ffffff' },
  doc: { label: 'W', bg: '#2b579a', fg: '#ffffff' },
  pdf: { label: 'PDF', bg: '#c5362b', fg: '#ffffff' },
  fig: { label: 'F', bg: '#1e1e1e', fg: '#ffffff' }
}

export function FileTypeBadge({ name, size = 18 }: { name: string; size?: number }) {
  const badge = fileBadges[name.split('.').pop()?.toLowerCase() || '']
  if (!badge) return <FileText size={size} aria-hidden="true" />
  return <span className="file-badge" aria-hidden="true" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
}

// Local monogram for a site (no network): first letter of the domain on a stable tint.
const siteTints = ['#2f6b4f', '#2c649e', '#6a4c9c', '#a5620c', '#a8425f', '#23716e', '#3d569a', '#85642a']
export function SiteMark({ url, title, className }: { url: string; title?: string; className?: string }) {
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '') } catch { /* keep empty */ }
  const letter = (host || title || '?').charAt(0).toUpperCase()
  const hash = [...host].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  const tint = siteTints[hash % siteTints.length]
  return <span className={className ? `site-mark ${className}` : 'site-mark'} aria-hidden="true" style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, white)` }}>{letter}</span>
}
