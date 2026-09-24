import { useEffect, useRef, useState } from 'react'
import {
  ChevronUp,
  Headphones,
  Pause,
  Play,
  Radio,
  SkipForward,
  Volume2,
  VolumeX,
  ExternalLink
} from 'lucide-react'
import {
  audioManager,
  RADIO_STATIONS,
  type MusicProvider
} from './audioStream'

interface Props {
  onOpenSettings?: () => void
}

export function PlayerIsland({ onOpenSettings: _onOpenSettings }: Props) {
  const [isPlaying, setIsPlaying] = useState(audioManager.getIsPlaying())
  const [station, setStation] = useState(audioManager.getStation())
  const [provider, setProvider] = useState<MusicProvider>(audioManager.getProvider())
  const [volume, setVolume] = useState(audioManager.getVolume())
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return audioManager.subscribe(() => {
      setIsPlaying(audioManager.getIsPlaying())
      setStation(audioManager.getStation())
      setProvider(audioManager.getProvider())
      setVolume(audioManager.getVolume())
    })
  }, [])

  // Close menu on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  function handleTogglePlay(e: React.MouseEvent) {
    e.stopPropagation()
    audioManager.togglePlay()
  }

  function handleNext(e: React.MouseEvent) {
    e.stopPropagation()
    audioManager.nextStation()
  }

  return (
    <div className="calm-player-wrapper" ref={menuRef}>
      {isOpen && (
        <div className="calm-player-popover" role="dialog" aria-label="Музыкальный центр">
          <div className="calm-player-tabs">
            <button
              className={provider === 'lofi' ? 'active' : ''}
              onClick={() => audioManager.setProvider('lofi')}
            >
              <Radio size={14} /> Lo-Fi
            </button>
            <button
              className={provider === 'spotify' ? 'active' : ''}
              onClick={() => audioManager.setProvider('spotify')}
            >
              Spotify
            </button>
            <button
              className={provider === 'yandex' ? 'active' : ''}
              onClick={() => audioManager.setProvider('yandex')}
            >
              Яндекс
            </button>
          </div>

          {provider === 'lofi' && (
            <div className="calm-player-body">
              <div className="station-list">
                {RADIO_STATIONS.map((s, idx) => (
                  <button
                    key={s.id}
                    className={`station-item ${station.id === s.id ? 'selected' : ''}`}
                    onClick={() => {
                      audioManager.setStation(idx)
                      if (!isPlaying) audioManager.play()
                    }}
                  >
                    <div className="station-info">
                      <span className="station-name">{s.name}</span>
                      <span className="station-sub">{s.subtitle}</span>
                    </div>
                    <span className="station-tag">{s.tag}</span>
                  </button>
                ))}
              </div>

              <div className="calm-volume-row">
                <button
                  className="calm-icon-mini"
                  onClick={() => audioManager.setVolume(volume > 0 ? 0 : 0.65)}
                  aria-label="Громкость"
                >
                  {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={volume}
                  onChange={e => audioManager.setVolume(parseFloat(e.target.value))}
                  aria-label="Регулятор громкости"
                />
              </div>
            </div>
          )}

          {provider === 'spotify' && (
            <div className="calm-player-external">
              <div className="external-status">
                <span className="provider-badge spotify">Spotify Connect</span>
                <p>Управление воспроизведением и плейлистами для концентрации.</p>
              </div>
              <button
                className="calm-soft-action"
                onClick={() => window.open('https://open.spotify.com', '_blank', 'noopener,noreferrer')}
              >
                Открыть веб-плеер Spotify <ExternalLink size={14} />
              </button>
            </div>
          )}

          {provider === 'yandex' && (
            <div className="calm-player-external">
              <div className="external-status">
                <span className="provider-badge yandex">Яндекс Музыка</span>
                <p>«Моя волна» и любимые треки для непрерывного потока.</p>
              </div>
              <button
                className="calm-soft-action"
                onClick={() => window.open('https://music.yandex.ru', '_blank', 'noopener,noreferrer')}
              >
                Открыть Яндекс Музыку <ExternalLink size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={`calm-player-island ${isPlaying ? 'playing' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={event => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            setIsOpen(open => !open)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Управление звуком"
      >
        <span className="player-indicator">
          {isPlaying ? (
            <span className="sound-waves">
              <span className="wave-bar bar-1" />
              <span className="wave-bar bar-2" />
              <span className="wave-bar bar-3" />
            </span>
          ) : (
            <Headphones size={16} />
          )}
        </span>

        <span className="player-title">
          {provider === 'lofi' ? (
            <>
              <strong>{station.name}</strong>
              <small>{isPlaying ? 'В эфире' : 'Пауза'}</small>
            </>
          ) : provider === 'spotify' ? (
            <>
              <strong>Spotify</strong>
              <small>Внешний плеер</small>
            </>
          ) : (
            <>
              <strong>Яндекс Музыка</strong>
              <small>Моя волна</small>
            </>
          )}
        </span>

        <div className="player-controls">
          <button
            className="player-control-btn play-btn"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? 'Пауза' : 'Слушать'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
          </button>
          {provider === 'lofi' && (
            <button
              className="player-control-btn next-btn"
              onClick={handleNext}
              aria-label="Следующая станция"
              title="Следующая станция"
            >
              <SkipForward size={14} />
            </button>
          )}
          <button
            className={`player-control-btn chevron-btn ${isOpen ? 'open' : ''}`}
            aria-label="Меню плеера"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
