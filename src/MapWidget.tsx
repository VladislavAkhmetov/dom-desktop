import { useState, useEffect } from 'react'
import { ExternalLink, Layers, MapPin, Navigation, Search, X } from 'lucide-react'

export type MapProvider = 'yandex' | 'google'

interface Props {
  onOpenInTab?: (url: string) => void
}

export function MapWidget({ onOpenInTab }: Props) {
  const [provider, setProvider] = useState<MapProvider>(() => {
    try {
      return (localStorage.getItem('dom-map-provider') as MapProvider) || 'yandex'
    } catch {
      return 'yandex'
    }
  })

  const [query, setQuery] = useState<string>(() => {
    try {
      return localStorage.getItem('dom-map-query') || 'Уфа'
    } catch {
      return 'Уфа'
    }
  })

  const [searchInput, setSearchInput] = useState(query)
  const [traffic, setTraffic] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dom-map-traffic') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('dom-map-provider', provider)
    } catch {}
  }, [provider])

  useEffect(() => {
    try {
      localStorage.setItem('dom-map-query', query)
    } catch {}
  }, [query])

  useEffect(() => {
    try {
      localStorage.setItem('dom-map-traffic', String(traffic))
    } catch {}
  }, [traffic])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchInput.trim()) {
      setQuery(searchInput.trim())
    }
  }

  function handleQuickCity(city: string) {
    setSearchInput(city)
    setQuery(city)
  }

  // Generate embed URL and full browser URL
  let embedUrl = ''
  let fullUrl = ''

  if (provider === 'yandex') {
    const encoded = encodeURIComponent(query)
    const trafficParam = traffic ? '&l=trf%2Ctrfe' : ''
    embedUrl = `https://yandex.ru/map-widget/v1/?text=${encoded}&z=12${trafficParam}`
    fullUrl = `https://yandex.ru/maps/?text=${encoded}${trafficParam}`
  } else {
    const encoded = encodeURIComponent(traffic ? `${query} traffic` : query)
    embedUrl = `https://maps.google.com/maps?q=${encoded}&t=&z=13&ie=UTF8&iwloc=&output=embed`
    fullUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
  }

  function openBrowser() {
    if (onOpenInTab) {
      onOpenInTab(fullUrl)
    } else {
      window.open(fullUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="map-widget" aria-label="Карты и дорожная ситуация">
      <div className="map-widget-header">
        <div className="map-title-row">
          <div className="map-title-badge">
            <MapPin size={16} />
            <strong>Карта</strong>
          </div>

          <div className="map-provider-pills">
            <button
              type="button"
              className={`map-provider-btn ${provider === 'yandex' ? 'is-active' : ''}`}
              onClick={() => setProvider('yandex')}
            >
              Яндекс
            </button>
            <button
              type="button"
              className={`map-provider-btn ${provider === 'google' ? 'is-active' : ''}`}
              onClick={() => setProvider('google')}
            >
              Google
            </button>
          </div>
        </div>

        <div className="map-controls-row">
          <form className="map-search-form" onSubmit={handleSearchSubmit}>
            <Search size={13} className="map-search-icon" />
            <input
              type="text"
              className="map-search-input"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Город, улица или место…"
              aria-label="Поиск по карте"
            />
            {searchInput !== query && (
              <button type="submit" className="map-search-submit" title="Найти">
                <Navigation size={12} />
              </button>
            )}
            {searchInput && (
              <button
                type="button"
                className="map-search-clear"
                onClick={() => {
                  setSearchInput('')
                }}
                title="Очистить"
              >
                <X size={12} />
              </button>
            )}
          </form>

          <div className="map-actions-group">
            <button
              type="button"
              className={`map-traffic-btn ${traffic ? 'is-active' : ''}`}
              onClick={() => setTraffic(v => !v)}
              title={traffic ? 'Скрыть пробки' : 'Показать пробки'}
              aria-pressed={traffic}
            >
              <Layers size={13} />
              <span>Пробки</span>
            </button>

            <button
              type="button"
              className="map-open-tab-btn"
              onClick={openBrowser}
              title="Открыть карту в новой вкладке"
              aria-label="Открыть во вкладке"
            >
              <ExternalLink size={13} />
            </button>
          </div>
        </div>

        <div className="map-chips-row">
          {['Уфа', 'Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург'].map(c => (
            <button
              key={c}
              type="button"
              className={`map-chip ${query === c ? 'is-selected' : ''}`}
              onClick={() => handleQuickCity(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="map-iframe-container">
        <iframe
          key={`${provider}-${query}-${traffic}`}
          src={embedUrl}
          className="map-iframe"
          title={`Карта ${query}`}
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  )
}
