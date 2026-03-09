import React, { useState, useEffect } from 'react'
import type { ExtSettings } from '../shared/types'

type ConnStatus = 'idle' | 'checking' | 'ok' | 'error'

type PingResponse = { authenticated?: boolean; error?: string }
type SettingsResponse = { settings?: ExtSettings }

function safeSendMessage<T = unknown>(message: unknown, onResponse: (response: T | undefined) => void) {
  try {
    chrome.runtime.sendMessage(message, res => {
      if (chrome.runtime.lastError) {
        onResponse(undefined)
        return
      }
      onResponse(res as T)
    })
  } catch {
    onResponse(undefined)
  }
}

export function Popup() {
  const [settings, setSettings] = useState<ExtSettings>({ apiBaseUrl: 'http://127.0.0.1:3001', apiToken: '' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status,   setStatus]   = useState<ConnStatus>('idle')
  const [errMsg,   setErrMsg]   = useState('')

  useEffect(() => {
    safeSendMessage<SettingsResponse>({ type: 'GET_SETTINGS' }, res => {
      if (res?.settings) setSettings(res.settings)
    })
    safeSendMessage<PingResponse>({ type: 'PING' }, res => {
      setStatus(res?.authenticated ? 'ok' : 'idle')
      if (res && !res.authenticated && res.error) setErrMsg(res.error)
    })
  }, [])

  const saveToken = async () => {
    if (!settings.apiToken.trim()) {
      setStatus('error')
      setErrMsg('Token vazio. Use "Entrar com email/senha" ou informe um token manual.')
      return
    }
    setStatus('checking')
    setErrMsg('')
    safeSendMessage<PingResponse>({ type: 'SAVE_SETTINGS', settings }, res => {
      if (res?.authenticated) {
        setStatus('ok')
      } else {
        setStatus('error')
        setErrMsg(res?.error ?? 'Nao autenticado: verifique URL da API e token')
      }
    })
  }

  const login = async () => {
    setStatus('checking')
    setErrMsg('')
    // Login via background script (evita bloqueio do antivirus no popup)
    safeSendMessage<{ ok?: boolean; authenticated?: boolean; error?: string; settings?: ExtSettings }>(
      { type: 'LOGIN', apiBaseUrl: settings.apiBaseUrl, email, password },
      res => {
        if (res?.ok && res.authenticated) {
          setStatus('ok')
          setPassword('')
          if (res.settings) setSettings(res.settings)
        } else {
          setStatus('error')
          setErrMsg(res?.error ?? 'Falha no login')
        }
      },
    )
  }

  const statusColor: Record<ConnStatus, string> = {
    idle:     '#6b7280',
    checking: '#d97706',
    ok:       '#16a34a',
    error:    '#dc2626',
  }
  const statusLabel: Record<ConnStatus, string> = {
    idle:     'Nao verificado',
    checking: 'Verificando...',
    ok:       'Conectado',
    error:    'Erro de conexao',
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, background: '#075e54', borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 15,
        }}>
          MV
        </div>
        <div>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>Minha Viagem</div>
          <div style={{ fontSize: 11, color: statusColor[status] }}>{statusLabel[status]}</div>
        </div>
      </div>

      {/* Campos */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>URL do servidor:</label>
        <input
          value={settings.apiBaseUrl}
          onChange={e => setSettings(s => ({ ...s, apiBaseUrl: e.target.value }))}
          placeholder="http://localhost:3001"
          style={inp}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Token de acesso (debug):</label>
        <input
          type="password"
          value={settings.apiToken}
          onChange={e => setSettings(s => ({ ...s, apiToken: e.target.value }))}
          placeholder="Opcional: sobrescreve JWT de login"
          style={inp}
        />
      </div>

      <div style={{ marginBottom: 8, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Login principal (JWT)</div>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          style={{ ...inp, marginBottom: 6 }}
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Senha"
          style={inp}
        />
      </div>

      <button
        onClick={login}
        disabled={status === 'checking' || !email || !password}
        style={{
          width: '100%', padding: '8px 12px',
          background: '#0f766e',
          color: '#fff', border: 'none', borderRadius: 7,
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          marginBottom: 8,
          opacity: status === 'checking' || !email || !password ? 0.7 : 1,
        }}
      >
        {status === 'checking' ? 'Autenticando...' : 'Entrar com email/senha'}
      </button>

      <button
        onClick={saveToken}
        disabled={status === 'checking' || !settings.apiToken.trim()}
        style={{
          width: '100%', padding: '8px 12px',
          background: status === 'ok' ? '#16a34a' : '#075e54',
          color: '#fff', border: 'none', borderRadius: 7,
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          marginBottom: 8,
          opacity: status === 'checking' ? 0.7 : 1,
        }}
      >
        {status === 'checking' ? 'Conectando...' : status === 'ok' ? 'Salvo e conectado' : 'Salvar e conectar'}
      </button>

      {status === 'error' && (
        <div style={{ padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>
          {errMsg}
        </div>
      )}

      {/* Links rapidos */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, display: 'flex', gap: 12 }}>
        <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={link}>
          Abrir dashboard
        </a>
        <span style={{ color: '#e5e7eb' }}>|</span>
        <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" style={link}>
          WhatsApp Web
        </a>
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
        v1.0.0 - Somente envio assistido (manual)
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 3 }
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 12, boxSizing: 'border-box',
}
const link: React.CSSProperties = { color: '#2563eb', fontSize: 12, textDecoration: 'none', fontWeight: 600 }
