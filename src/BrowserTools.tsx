import { useState } from 'react'
import { Dialog } from './Dialog'
import { zenTimer } from './focus/zenTimer'
import { PlayerIsland } from './player/PlayerIsland'
export function BrowserTools() {
  const [open, setOpen] = useState(false)
  return <><button className="chrome-button" aria-label="Фокус и музыка" onClick={() => setOpen(true)}>◷</button>{open && <Dialog title="Фокус и музыка" onClose={() => setOpen(false)}><div className="focus-choices">{[15, 30, 50].map(minutes => <button className="soft-button" key={minutes} onClick={() => { zenTimer.start(minutes, false); setOpen(false) }}>{minutes} минут</button>)}<button className="soft-button" onClick={() => { zenTimer.stop(); setOpen(false) }}>Завершить фокус</button></div><PlayerIsland /></Dialog>}</>
}
