// Deteccao de intencao + sugestao de resposta
// MVP: classificacao por regex local (sem LLM)
// Trilha 2: chama backend que usa LLM

import React, { useState, useEffect } from 'react'

type Intent = 'cotacao' | 'stop' | 'comprou' | 'duvida' | 'neutro'

const PATTERNS: Array<{ intent: Intent; re: RegExp[] }> = [
  { intent: 'stop',    re: [/\bsair\b/i, /\bstop\b/i, /\bparar\b/i, /\bnao quero\b/i, /\bremov[ea]\b/i] },
  { intent: 'cotacao', re: [/\bcotar?\b/i, /\bpreco\b/i, /\bquanto\b/i, /\bvalor\b/i, /\bparcela\b/i, /\borcamento\b/i] },
  { intent: 'comprou', re: [/\bcomprei\b/i, /\bja comprei\b/i, /\bpaguei\b/i, /\bfiz a reserva\b/i] },
  { intent: 'duvida',  re: [/\bduvida\b/i, /\bpergunta\b/i, /\bcomo funciona\b/i, /\bpode\b/i, /\btem\b/i] },
]

function detectIntent(text: string): Intent {
  for (const { intent, re } of PATTERNS) {
    if (re.some(r => r.test(text))) return intent
  }
  return 'neutro'
}

const INTENT_META: Record<Intent, { label: string; color: string }> = {
  stop:    { label: 'Pedido de opt-out',   color: '#dc2626' },
  cotacao: { label: 'Interesse em cotacao', color: '#2563eb' },
  comprou: { label: 'Ja comprou',           color: '#16a34a' },
  duvida:  { label: 'Duvida',               color: '#d97706' },
  neutro:  { label: 'Geral',               color: '#6b7280' },
}

const SUGGESTIONS: Record<Intent, string[]> = {
  stop: [
    'Tudo bem, vou remover voce da lista. Se quiser receber novidades no futuro, e so me avisar. Bom dia!',
    'Entendido, nao enviarei mais mensagens. Qualquer duvida sobre viagens futura, estou disponivel.',
  ],
  cotacao: [
    'Ola! Fico feliz com seu interesse. Me passa quantas pessoas viajam e as datas para eu montar a cotacao.',
    'Claro, vou preparar uma proposta. Datas fixas ou flexiveis? Adultos e criancas?',
    'Otimo! Para a cotacao preciso de: numero de pessoas, datas de ida e volta, e se prefere voo incluso.',
  ],
  comprou: [
    'Parabens pela viagem! Para qualquer duvida sobre documentos ou roteiro, pode me chamar.',
    'Excelente escolha! Se precisar de dicas sobre passeios ou seguro viagem, estou aqui.',
  ],
  duvida: [
    'Boa pergunta! Me conta mais detalhes para eu te ajudar melhor.',
    'Claro, pode perguntar. Estou aqui para tirar todas as suas duvidas.',
  ],
  neutro: [
    'Oi! Posso te ajudar com informacoes sobre viagens ou cotacoes?',
    'Obrigado pela mensagem! Tem algo em que posso ajudar?',
  ],
}

// Preenche a caixa de composicao sem enviar
const COMPOSE_SEL = [
  '[data-testid="conversation-compose-box-input"]',
  'div[contenteditable="true"][data-tab="10"]',
  'footer div[contenteditable="true"]',
]

function fillCompose(text: string): boolean {
  for (const sel of COMPOSE_SEL) {
    const box = document.querySelector<HTMLElement>(sel)
    if (box) {
      box.focus()
      document.execCommand('selectAll', false)
      document.execCommand('insertText', false, text)
      box.dispatchEvent(new InputEvent('input', { bubbles: true }))
      return true
    }
  }
  return false
}

interface Props {
  lastMessage:     string
  onStopDetected:  () => void
}

export function SuggestedReply({ lastMessage, onStopDetected }: Props) {
  const [chosen,    setChosen]    = useState<number | null>(null)
  const [filled,    setFilled]    = useState(false)

  // Reseta estado ao mudar de mensagem
  useEffect(() => {
    setChosen(null)
    setFilled(false)
  }, [lastMessage])

  if (!lastMessage) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
        Aguardando mensagem do contato...
      </div>
    )
  }

  const intent   = detectIntent(lastMessage)
  const meta     = INTENT_META[intent]
  const replies  = SUGGESTIONS[intent]

  const handleFill = () => {
    if (chosen === null) return
    const ok = fillCompose(replies[chosen])
    if (ok) {
      setFilled(true)
      if (intent === 'stop') onStopDetected()
    }
  }

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      {/* Ultima mensagem */}
      <div style={{ marginBottom: 10 }}>
        <div style={lbl}>Ultima mensagem recebida:</div>
        <div style={msgBox}>{lastMessage}</div>
      </div>

      {/* Intencao */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={lbl}>Intencao detectada:</span>
        <span style={{ background: meta.color, color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
          {meta.label}
        </span>
      </div>

      {/* Sugestoes */}
      <div style={lbl}>Sugestoes (escolha uma e confirme antes de usar):</div>
      {replies.map((r, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div
            onClick={() => { setChosen(i); setFilled(false) }}
            style={{
              background: chosen === i ? '#eff6ff' : '#f9fafb',
              border: `1px solid ${chosen === i ? '#93c5fd' : '#e5e7eb'}`,
              borderRadius: 6, padding: '8px 10px', fontSize: 12,
              color: '#374151', cursor: 'pointer', lineHeight: 1.5,
              transition: 'border-color 0.15s',
            }}
          >
            {r}
          </div>
          {chosen === i && (
            <button
              onClick={() => setChosen(i)}
              style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            >
              Selecionada
            </button>
          )}
        </div>
      ))}

      {/* Confirmacao antes de preencher */}
      {chosen !== null && !filled && (
        <div style={{ marginTop: 8, padding: 10, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: '#854d0e', fontWeight: 600, marginBottom: 6 }}>
            Confirmar: preencher caixa de mensagem com a sugestao?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleFill} style={okBtn}>Sim, preencher</button>
            <button onClick={() => setChosen(null)} style={cancelBtn}>Cancelar</button>
          </div>
        </div>
      )}

      {filled && (
        <div style={{ marginTop: 8, padding: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#166534', fontWeight: 600 }}>
          Mensagem pronta. Clique Enviar no WhatsApp para confirmar.
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties     = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }
const msgBox: React.CSSProperties  = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#374151', maxHeight: 80, overflowY: 'auto', lineHeight: 1.5 }
const okBtn: React.CSSProperties   = { padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: 700 }
const cancelBtn: React.CSSProperties = { padding: '5px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer' }
