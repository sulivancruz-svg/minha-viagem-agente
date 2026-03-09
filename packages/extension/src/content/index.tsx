// Content script principal
// Aguarda o WhatsApp Web carregar e injeta o painel lateral

import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SalesShell } from './SalesShell'
import { useCurrentChat } from './hooks/useCurrentChat'
import { Storage } from '../shared/storage'

declare global {
  interface Window {
    __MV_MOUNTED__?: boolean
  }
}

const PANEL_WIDTH = 340
const WA_LAYOUT_SELECTORS = [
  '#app',
  'body > #app',
  'body > div#app',
  'body > div[id="app"]',
]

function findWhatsAppLayoutElement(): HTMLElement | null {
  for (const sel of WA_LAYOUT_SELECTORS) {
    const el = document.querySelector(sel)
    if (el instanceof HTMLElement) return el
  }
  return null
}

// Wrapper que usa o hook e passa dados para o painel
function PanelWrapper() {
  const chat = useCurrentChat()
  const [isOpen, setIsOpen] = useState(true)
  const lastLoggedKey = useRef<string>('')
  const layoutElRef = useRef<HTMLElement | null>(null)
  const originalMarginRightRef = useRef<string>('')
  const originalTransitionRef = useRef<string>('')
  const initializedLayoutRef = useRef(false)

  const restoreLayout = useCallback(() => {
    const el = layoutElRef.current
    if (!el) return
    el.style.marginRight = originalMarginRightRef.current
    el.style.transition = originalTransitionRef.current
  }, [])

  const applyLayoutOffset = useCallback((open: boolean) => {
    const nextTarget = findWhatsAppLayoutElement()
    if (!nextTarget) return

    if (layoutElRef.current !== nextTarget || !initializedLayoutRef.current) {
      layoutElRef.current = nextTarget
      originalMarginRightRef.current = nextTarget.style.marginRight
      originalTransitionRef.current = nextTarget.style.transition
      initializedLayoutRef.current = true
    }

    const el = layoutElRef.current
    if (!el) return

    if (open) {
      const baseTransition = originalTransitionRef.current || ''
      el.style.transition = baseTransition
        ? `${baseTransition}, margin-right 180ms ease`
        : 'margin-right 180ms ease'
      el.style.marginRight = `${PANEL_WIDTH}px`
      return
    }

    restoreLayout()
  }, [restoreLayout])

  useEffect(() => {
    let active = true
    Storage.getUiState()
      .then(open => {
        if (!active) return
        setIsOpen(open)
      })
      .catch(() => {
        if (!active) return
        setIsOpen(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    try {
      const key = chat
        ? chat.type === 'CHAT'
          ? `CHAT|${chat.chat.name}|${chat.chat.phoneE164 ?? ''}`
          : `${chat.type}|${chat.name}`
        : 'null'
      if (key === lastLoggedKey.current) return
      lastLoggedKey.current = key
    } catch (e) {
    }
  }, [chat])

  useEffect(() => {
    applyLayoutOffset(isOpen)
    Storage.setUiState(isOpen).catch(() => undefined)
  }, [isOpen, applyLayoutOffset])

  useEffect(() => {
    const onBeforeUnload = () => restoreLayout()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      restoreLayout()
    }
  }, [restoreLayout])

  return (
    <>
      <div style={isOpen ? panelDockOpen : panelDockClosed}>
        <SalesShell currentChat={chat} onClose={() => setIsOpen(false)} />
      </div>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Abrir Minha Viagem"
          style={openHandle}
        >
          {'>'}
        </button>
      )}
    </>
  )
}

function isWhatsAppReady(): boolean {
  const readySelectors = [
    '[data-testid="chat-list"]',
    '[aria-label*="conversas" i]',
    '[aria-label*="chats" i]',
    '[data-testid="chatlist-header"]',
    '[data-testid="default-user"]',
    '[data-testid="conversation-panel-wrapper"]',
  ]
  return readySelectors.some(sel => document.querySelector(sel) !== null)
}

async function waitForWhatsAppReady(timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (isWhatsAppReady()) return true
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return false
}

async function injectPanel(): Promise<void> {
  try {
    if (window.top !== window.self) return

    // Evita injecao dupla
    if (window.__MV_MOUNTED__) return
    if (document.getElementById('mv-root')) return

    const ready = await waitForWhatsAppReady(10_000)
    if (!ready) return

    const host = document.documentElement
    if (!host) return

    // Container posicionado como overlay lateral fixo
    const container = document.createElement('div')
    container.id = 'mv-root'
    container.style.cssText = [
      'position: fixed',
      'top: 0',
      'right: 0',
      'width: 0',
      'height: 100vh',
      'z-index: 2147483647',
      'overflow: visible',
    ].join(';')

    // Shadow DOM para isolar estilos do WA Web
    const shadow = container.attachShadow({ mode: 'open' })

    // Reset basico dentro do shadow
    const style = document.createElement('style')
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      :host { all: initial; }
      div { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button:focus { outline: 2px solid #075e54; outline-offset: 1px; }
      select:focus { outline: 2px solid #075e54; }
      a { color: #075e54; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
      @keyframes mv-spin { to { transform: rotate(360deg); } }
    `
    shadow.appendChild(style)

    // Ponto de montagem do React
    const mount = document.createElement('div')
    mount.style.height = '100%'
    shadow.appendChild(mount)

    host.appendChild(container)
    window.__MV_MOUNTED__ = true

    // Monta o React
    const root = createRoot(mount)
    root.render(<PanelWrapper />)
  } catch (e) {
    return
  }
}

// Injecao inicial

// Reinjecao apos reload completo da pagina (edge case)
window.addEventListener('load', () => {
  if (window.__MV_MOUNTED__) return
  if (document.getElementById('mv-root')) return
})

const panelDockOpen: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: PANEL_WIDTH,
  height: '100vh',
  zIndex: 2147483647,
  boxShadow: '-3px 0 12px rgba(0,0,0,0.15)',
  transition: 'transform 180ms ease, opacity 180ms ease',
  transform: 'translateX(0)',
  opacity: 1,
}

const panelDockClosed: React.CSSProperties = {
  ...panelDockOpen,
  display: 'none',
}

const openHandle: React.CSSProperties = {
  position: 'fixed',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 28,
  height: 72,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
  zIndex: 2147483647,
}
