// Detecta qual conversa esta aberta no WhatsApp Web
// Usa MutationObserver para lidar com a navegacao SPA

import { useState, useEffect } from 'react'
import type { CurrentChatState, DetectedChat } from '../../shared/types'

const SEL = {
  selectedConversation: [
    '#pane-side [role="listitem"][aria-selected="true"]',
    '#pane-side [aria-selected="true"]',
    '[data-testid="cell-frame-container"][aria-selected="true"]',
  ],
  header: [
    '[data-testid="conversation-header"]',
    'header[data-testid]',
    '#main header',
  ],
  contactName: [
    '[data-testid="conversation-header"] span[dir="auto"]',
    '[data-testid="conversation-header"] [title]',
    '#main header span[dir="auto"]',
    '#main header [title]',
  ],
  chatMessages: [
    '[data-testid="conversation-panel-messages"]',
    '#main [role="application"]',
    '#main',
  ],
}

function querySelector(selectors: string[]): Element | null {
  try {
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) return el
    }
  } catch (e) {
  }
  return null
}

function extractJid(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/(\d+)@(c\.us|s\.whatsapp\.net)/i)
  return m ? `${m[1]}@${m[2].toLowerCase()}` : null
}

function extractPhoneFromJid(jid: string | null): string | null {
  if (!jid) return null
  const m = jid.match(/(\d+)@(c\.us|s\.whatsapp\.net)$/i)
  if (!m) return null
  return `+${m[1]}`
}

function detectPhoneFromUrl(): string | null {
  try {
    const full = `${window.location.href} ${window.location.pathname} ${window.location.search} ${window.location.hash}`
    const jidInUrl = extractJid(full)
    const fromJid = extractPhoneFromJid(jidInUrl)
    if (fromJid) return fromJid

    const url = new URL(window.location.href)
    const phoneParam = url.searchParams.get('phone')
    if (phoneParam) {
      const digits = phoneParam.replace(/\D/g, '')
      if (digits) return `+${digits}`
    }

    const sendPath = window.location.pathname.match(/\/send\/(\d{6,20})/)
    if (sendPath) return `+${sendPath[1]}`
  } catch (e) {
  }
  return null
}

function findJidInAttributes(el: Element): string | null {
  // WhatsApp muda nomes dos atributos com frequencia; varremos todos.
  for (const attrName of el.getAttributeNames()) {
    const value = el.getAttribute(attrName)
    const jid = extractJid(value)
    if (jid) return jid
  }
  return null
}

function findJidInHtmlFragment(html: string | null | undefined): string | null {
  if (!html) return null
  return extractJid(html)
}

function tryJidFromUserServerPair(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  const maybe = input as Record<string, unknown>
  const user = maybe.user
  const server = maybe.server
  if (typeof user === 'string' && /^\d+$/.test(user) && typeof server === 'string' && /^(c\.us|s\.whatsapp\.net)$/i.test(server)) {
    return `${user}@${server.toLowerCase()}`
  }
  return null
}

function findJidInUnknownObject(input: unknown, seen = new WeakSet<object>(), depth = 0): string | null {
  if (depth > 5 || input == null) return null

  if (typeof input === 'string') {
    return extractJid(input)
  }

  if (typeof input !== 'object') return null

  const obj = input as Record<string, unknown>
  if (seen.has(obj)) return null
  seen.add(obj)

  const fromPair = tryJidFromUserServerPair(obj)
  if (fromPair) return fromPair

  // Campos comuns em objetos internos do WhatsApp.
  for (const key of ['jid', 'wid', 'id', 'chatId', 'contactId', '_serialized']) {
    const value = obj[key]
    const fromValue = findJidInUnknownObject(value, seen, depth + 1)
    if (fromValue) return fromValue
  }

  for (const value of Object.values(obj)) {
    const found = findJidInUnknownObject(value, seen, depth + 1)
    if (found) return found
  }

  return null
}

function findJidInReactInternals(el: Element): string | null {
  const node = el as unknown as Record<string, unknown>
  for (const key of Object.getOwnPropertyNames(node)) {
    if (!key.startsWith('__reactProps$') && !key.startsWith('__reactFiber$')) continue
    const candidate = node[key]
    const jid = findJidInUnknownObject(candidate)
    if (jid) return jid
  }
  return null
}

function findJidInElementTree(root: Element): string | null {
  const queue: Element[] = [root]
  while (queue.length > 0) {
    const cur = queue.shift()!
    const jid = findJidInAttributes(cur)
    if (jid) return jid
    const jidFromReact = findJidInReactInternals(cur)
    if (jidFromReact) return jidFromReact
    const jidFromHtml = findJidInHtmlFragment(cur.outerHTML)
    if (jidFromHtml) return jidFromHtml
    queue.push(...Array.from(cur.children))
  }
  return null
}

function findJidFromAncestors(el: Element | null): string | null {
  let cur: Element | null = el
  let steps = 0
  while (cur && steps < 10) {
    const jid = findJidInAttributes(cur)
    if (jid) return jid
    const jidFromReact = findJidInReactInternals(cur)
    if (jidFromReact) return jidFromReact
    const jidFromHtml = findJidInHtmlFragment(cur.outerHTML)
    if (jidFromHtml) return jidFromHtml
    cur = cur.parentElement
    steps++
  }
  return null
}

function detectJidFromActiveView(): { jid: string | null; phoneE164: string | null; rawPhone?: string } {
  try {
    const roots = [
      querySelector(SEL.selectedConversation),
      querySelector(SEL.chatMessages),
      querySelector(SEL.header),
      document.getElementById('main'),
    ].filter(Boolean) as Element[]

    for (const root of roots) {
      const fromTree = findJidInElementTree(root)
      const fromAncestors = findJidFromAncestors(root)
      const jid = fromTree ?? fromAncestors
      const phoneE164 = extractPhoneFromJid(jid)
      if (jid && phoneE164) return { jid, phoneE164, rawPhone: phoneE164.replace('+', '') }
    }

    const phoneFromUrl = detectPhoneFromUrl()
    if (phoneFromUrl) {
      return {
        jid: null,
        phoneE164: phoneFromUrl,
        rawPhone: phoneFromUrl.replace('+', ''),
      }
    }
  } catch (e) {
  }
  return { jid: null, phoneE164: null }
}

function contactNameFromDOM(): string {
  const selected = querySelector(SEL.selectedConversation)
  if (selected) {
    const candidates = Array.from(selected.querySelectorAll('[title],[dir="auto"]'))
    for (const el of candidates) {
      const title = el.getAttribute('title')?.trim()
      if (title) return title.replace(/\s+/g, ' ').trim()
      const text = el.textContent?.trim()
      if (text) return text.replace(/\s+/g, ' ').trim()
    }
  }

  const els = Array.from(document.querySelectorAll(SEL.contactName.join(',')))
  for (const el of els) {
    const title = el.getAttribute('title')?.trim()
    if (title) return title.replace(/\s+/g, ' ').trim()
    const text = el.textContent?.trim()
    if (text) return text.replace(/\s+/g, ' ').trim()
  }
  return ''
}

export function useCurrentChat(): CurrentChatState | null {
  const [chat, setChat] = useState<CurrentChatState | null>(null)

  useEffect(() => {
    let prevUrl = window.location.href
    let updateTimer: number | undefined

    const updateChat = () => {
      try {
        const name = contactNameFromDOM()
        const fromJid = detectJidFromActiveView()
        const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim()
        const isProfileLike = /dados do perfil|profile info|perfil/i.test(normalizedName)

        if (isProfileLike) {
          setChat({ type: 'VIEW_PROFILE', name: name || 'Dados do perfil' })
          return
        }

        if (fromJid.phoneE164) {
          const nextChat: DetectedChat = {
            name: (name || 'Conversa').replace(/\s+/g, ' ').trim(),
            phoneE164: fromJid.phoneE164,
            rawPhone: fromJid.rawPhone,
          }

          setChat(prev => {
            if (prev?.type !== 'CHAT') return { type: 'CHAT', chat: nextChat }
            if (
              prev.chat.name === nextChat.name &&
              prev.chat.phoneE164 === nextChat.phoneE164 &&
              prev.chat.rawPhone === nextChat.rawPhone
            ) return prev
            return { type: 'CHAT', chat: nextChat }
          })
          return
        }

        if (name) {
          const normalized = name.replace(/\s+/g, ' ').trim()
          setChat(prev => {
            if (prev?.type === 'CHAT_NO_JID' && prev.name === normalized) return prev
            return { type: 'CHAT_NO_JID', name: normalized }
          })
          return
        }

        setChat(prev => (prev === null ? prev : null))
      } catch (e) {
        setChat(null)
      }
    }

    const scheduleUpdate = (delay = 180) => {
      if (updateTimer) window.clearTimeout(updateTimer)
      updateTimer = window.setTimeout(updateChat, delay)
    }

    const observer = new MutationObserver(() => {
      try {
        const currentUrl = window.location.href
        if (currentUrl !== prevUrl) {
          prevUrl = currentUrl
          scheduleUpdate(350)
        } else {
          scheduleUpdate(180)
        }
      } catch (e) {
      }
    })

    const target = document.body ?? document.documentElement
    if (!target) return
    observer.observe(target, { childList: true, subtree: true })
    scheduleUpdate(500)

    return () => {
      if (updateTimer) window.clearTimeout(updateTimer)
      observer.disconnect()
    }
  }, [])

  return chat
}

export function useLastInboundMessage(chatName: string | undefined): string {
  const [lastMsg, setLastMsg] = useState('')

  useEffect(() => {
    if (!chatName) {
      setLastMsg('')
      return
    }

    const textOf = (el: Element | null): string => (el?.textContent || '').replace(/\s+/g, ' ').trim()

    const isOutgoing = (container: Element): boolean => {
      const wrapper = container.closest('[data-testid="msg-container"], .message-out, .message-in')
      const classes = `${(container as HTMLElement).className || ''} ${(wrapper as HTMLElement | null)?.className || ''}`.toLowerCase()

      if (classes.includes('message-out')) return true
      if (classes.includes('message-in')) return false

      if (container.querySelector('[data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-testid="msg-check"], [data-testid="msg-dblcheck"]')) {
        return true
      }

      const withMeta = container.closest('[data-pre-plain-text]') ?? container.querySelector('[data-pre-plain-text]')
      const pre = withMeta?.getAttribute('data-pre-plain-text') || ''
      if (/\b(voce|você|you)\b/i.test(pre)) return true

      return false
    }

    const extractInboundText = (container: Element): string => {
      const msgText = textOf(container.querySelector('[data-testid="msg-text"]'))
      if (msgText) return msgText

      const selectable = Array.from(container.querySelectorAll('span.selectable-text span'))
        .map(el => textOf(el))
        .filter(Boolean)
      if (selectable.length > 0) return selectable.join(' ').replace(/\s+/g, ' ').trim()

      const autoText = textOf(container.querySelector('span[dir="auto"]'))
      if (autoText) return autoText

      const ltrText = textOf(container.querySelector('span[dir="ltr"]'))
      if (ltrText) return ltrText

      return ''
    }

    const updateLastMsg = () => {
      try {
        const containers = document.querySelectorAll('[data-testid="msg-container"]')
        let last = ''
        containers.forEach(c => {
          if (isOutgoing(c)) return
          const text = extractInboundText(c)
          if (text) last = text
        })
        setLastMsg(last)
      } catch (e) {
      }
    }

    const chatPanel = querySelector(SEL.chatMessages)
    if (!chatPanel) return

    const obs = new MutationObserver(updateLastMsg)
    obs.observe(chatPanel, { childList: true, subtree: true })
    const timer = window.setInterval(updateLastMsg, 1500)
    updateLastMsg()

    return () => {
      obs.disconnect()
      window.clearInterval(timer)
    }
  }, [chatName])

  return lastMsg
}
