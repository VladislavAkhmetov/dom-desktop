import { ArrowUpRight, Globe2, Plus, X } from 'lucide-react'
import type { BrowserTab, ResearchSource, Space } from '../types'
import { BrowserPane } from './BrowserPane'
import './browser.css'

export interface WorkstageProps {
  space: Space
  tabs: BrowserTab[]
  activeTabId: string
  splitTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onAddTab: () => void
  onCloseSplit: () => void
  onOpenSourceInSplit: (source: ResearchSource) => void
  onGoHome: () => void
  onOpenTab: (tab: BrowserTab) => void
  onSaveTab: (tab: BrowserTab) => void
  onUpdateTab?: (tabId: string, updates: Partial<BrowserTab>) => void
}

export function Workstage({
  space,
  tabs,
  activeTabId,
  splitTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onCloseSplit,
  onOpenSourceInSplit,
  onGoHome,
  onOpenTab,
  onSaveTab,
  onUpdateTab
}: WorkstageProps) {
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]
  const splitTab = tabs.find(tab => tab.id === splitTabId && tab.id !== activeTab?.id)

  function pane(tab?: BrowserTab, secondary = false) {
    if (!tab) return null

    if (tab.url.startsWith('research://')) {
      const artifact = space.researchArtifacts?.find(item => item.id === tab.url.slice('research://'.length))
      return (
        <section className="canvas-pane" aria-label="Сохранённое исследование">
          <div className="canvas-link-content">
            <span className="canvas-kicker">{space.name} · исследование</span>
            <h1 className="canvas-page-title">{artifact?.query || 'Исследование'}</h1>
            {artifact ? (
              <>
                <p className="canvas-body-text">{artifact.summary}</p>
                <p className="canvas-body-text">{artifact.conclusion}</p>
                <div className="canvas-actions">
                  {artifact.sources.map(source => (
                    <button className="canvas-save-link" key={source.url} onClick={() => onOpenSourceInSplit(source)}>
                      {source.domain} <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="canvas-body-text">У этой вкладки нет сохранённых источников или текста. Создайте новую вкладку с адресом нужного материала.</p>
            )}
          </div>
        </section>
      )
    }

    return (
      <BrowserPane
        key={tab.id}
        tab={tab}
        space={space}
        isSplit={secondary}
        onCloseSplit={onCloseSplit}
        onUpdateTab={onUpdateTab}
        onSaveTab={onSaveTab}
        onOpenExternal={onOpenTab}
        onSelectQuickUrl={(url, title) => {
          onUpdateTab?.(tab.id, { url, title: title || new URL(url).hostname })
        }}
      />
    )
  }

  return (
    <main className="workstage-container" aria-label={`Поток ${space.name}`}>
      <div className="workstage-tabs-strip" role="tablist" aria-label="Вкладки потока">
        <button className="workstage-tab home-return-btn" onClick={onGoHome} title="Вернуться в Дом">
          ✳ дом.
        </button>
        {tabs.map(tab => (
          <div
            className={`workstage-tab-wrap ${tab.id === activeTab?.id ? 'active' : ''} ${tab.id === splitTab?.id ? 'split-active' : ''}`}
            key={tab.id}
          >
            <button
              className="workstage-tab"
              role="tab"
              aria-selected={tab.id === activeTab?.id}
              onClick={() => onSelectTab(tab.id)}
              title={tab.title || tab.url || 'Новая вкладка'}
            >
              <Globe2 size={16} />
              <span className="workstage-tab-title">{tab.title || tab.url || 'Новая вкладка'}</span>
            </button>
            <button
              className="tab-close"
              onClick={() => onCloseTab(tab.id)}
              title={`Закрыть ${tab.title}`}
              aria-label={`Закрыть ${tab.title}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button className="new-tab-btn" onClick={onAddTab} title="Новая вкладка" aria-label="Новая вкладка">
          <Plus size={18} />
        </button>
      </div>
      <div className={`workstage-canvas ${splitTab ? 'split' : ''}`}>
        {pane(activeTab)}
        {splitTab && pane(splitTab, true)}
      </div>
    </main>
  )
}
