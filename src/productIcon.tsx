import { AppWindow } from 'lucide-react'

export function productIcon(name: string) {
  if (/figma/i.test(name)) return <span className="figma-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
  if (/illustrator/i.test(name)) return <span className="illustrator-mark" aria-hidden="true">Ai</span>
  if (/photoshop/i.test(name)) return <span className="photoshop-mark" aria-hidden="true">Ps</span>
  if (/indesign/i.test(name)) return <span className="indesign-mark" aria-hidden="true">Id</span>
  if (/word/i.test(name)) return <span className="word-mark" aria-hidden="true">W</span>
  if (/code|vs\s*code|visual studio/i.test(name)) return <span className="vscode-mark" aria-hidden="true">VS</span>
  if (/telegram/i.test(name)) return <span className="telegram-mark" aria-hidden="true">TG</span>
  if (/notion/i.test(name)) return <span className="notion-mark" aria-hidden="true">N</span>
  if (/spotify/i.test(name)) return <span className="spotify-mark" aria-hidden="true">♫</span>
  if (/obsidian/i.test(name)) return <span className="obsidian-mark" aria-hidden="true">✦</span>
  if (/slack/i.test(name)) return <span className="slack-mark" aria-hidden="true">#</span>
  if (/docs|документ/i.test(name)) return <span className="docs-mark" aria-hidden="true">D</span>
  return <AppWindow size={22} strokeWidth={1.5} />
}
