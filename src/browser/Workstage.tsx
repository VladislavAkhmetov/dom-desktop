import { useState } from 'react'
import { ArrowUpRight, Globe2, Plus, X, PanelLeftClose, PanelLeftOpen, Pin, Archive, BookmarkPlus, GitBranch, FileInput } from 'lucide-react'
import type { BrowserTab, ResearchSource, Resource, Space } from '../types'
import { NativePane } from './NativePane'
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
  onOpenResource: (resource: Resource) => void
  onAddLink: () => void
  onUpdateTab?: (tabId: string, updates: Partial<BrowserTab>) => void
  onPark: () => void
  onImport: () => void
  onBranch: () => void
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
  onOpenResource,
  onAddLink,
  onUpdateTab,
  onPark,
  onImport,
  onBranch
}: WorkstageProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dom-tab-sidebar') === 'collapsed')
  const [search, setSearch] = useState('')
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
      <NativePane
        key={tab.id}
        tab={tab}
        space={space}
        isSplit={secondary}
        onCloseSplit={onCloseSplit}
        onUpdateTab={onUpdateTab}
        onSaveTab={onSaveTab}
        onOpenExternal={onOpenTab}
        onOpenResource={onOpenResource}
        onAddLink={onAddLink}
        onSelectQuickUrl={(url, title) => {
          onUpdateTab?.(tab.id, { url, title: title || new URL(url).hostname })
        }}
      />
    )
  }

  return (
    <main className={`workstage-container compact-stage ${collapsed ? 'sidebar-collapsed' : ''}`} aria-label={`Браузер · ${space.name}`}>
      <aside className="tab-sidebar" aria-label="Вкладки пространства">
        <div className="tab-sidebar-heading"><strong>{collapsed ? '' : space.name}</strong><button onClick={() => { setCollapsed(!collapsed); localStorage.setItem('dom-tab-sidebar', !collapsed ? 'collapsed' : 'expanded') }} title={collapsed ? 'Развернуть вкладки' : 'Свернуть вкладки'} aria-label={collapsed ? 'Развернуть вкладки' : 'Свернуть вкладки'}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
        {!collapsed && <input className="tab-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Найти вкладку" aria-label="Найти вкладку" />}
        <div className="vertical-tabs" role="tablist" aria-label="Открытые вкладки">
        <button className="workstage-tab home-return-btn" onClick={onGoHome} title="Вернуться в Дом">
          ✳ дом.
        </button>
        {tabs.filter(tab => `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))).map(tab => (
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
              {!collapsed && <span className="workstage-tab-title">{tab.pinned ? '• ' : ''}{tab.title || tab.url || 'Новая вкладка'}{tab.protected ? ' · не завершено' : ''}</span>}
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
          <Plus size={18} />{!collapsed && 'Новая вкладка'}
        </button>
        </div>
        <div className="tab-sidebar-footer">
          {activeTab?.parentTabId && tabs.some(tab => tab.id === activeTab.parentTabId) && <button onClick={() => onSelectTab(activeTab.parentTabId!)} title="Вернуться к исходной вкладке"><ArrowUpRight size={17} />{!collapsed && 'К исходной вкладке'}</button>}
          <button onClick={onPark} title="Сохранить и прибрать"><Archive size={17} />{!collapsed && 'Сохранить и прибрать'}</button>
          {activeTab?.url && <><button onClick={() => onSaveTab(activeTab)} title="Сохранить в материалы"><BookmarkPlus size={17} />{!collapsed && 'В материалы'}</button><button onClick={() => onUpdateTab?.(activeTab.id, { pinned: !activeTab.pinned })} title="Закрепить вкладку"><Pin size={17} />{!collapsed && (activeTab.pinned ? 'Открепить' : 'Закрепить')}</button><button onClick={onBranch} title="Открыть отдельную ветку"><GitBranch size={17} />{!collapsed && 'Отдельная ветка'}</button></>}
          <button onClick={onImport} title="Перенести вкладки"><FileInput size={17} />{!collapsed && 'Перенести вкладки'}</button>
        </div>
      </aside>
      <div className={`workstage-canvas ${splitTab ? 'split' : ''}`}>
        {pane(activeTab)}
        {splitTab && pane(splitTab, true)}
      </div>
    </main>
  )
}
