import React, { useState } from 'react'
import type { LeadInfo, LeadStageType } from '../shared/types'

const STAGE_META: Record<LeadStageType, { label: string; color: string }> = {
  NEW:              { label: 'Novo Lead',        color: '#3b82f6' },
  CONTACTED:        { label: 'Contatado',         color: '#8b5cf6' },
  QUOTE_REQUESTED:  { label: 'Pediu Cotacao',     color: '#f59e0b' },
  PROPOSAL_SENT:    { label: 'Proposta Enviada',  color: '#06b6d4' },
  CLOSED_WON:       { label: 'Fechado',           color: '#22c55e' },
  CLOSED_LOST:      { label: 'Perdido',           color: '#ef4444' },
  OPTED_OUT:        { label: 'Opt-out',           color: '#6b7280' },
}

interface Props {
  contactId: string
  contactName: string
  lead: LeadInfo
  disableActions?: boolean
  onStageChange: (stage: LeadStageType) => void
  onCreateTask:  (title: string, dueAt?: string) => void
  onBlock:       () => void
}

export function LeadCard({ contactName, lead, disableActions = false, onStageChange, onCreateTask, onBlock }: Props) {
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskTitle,    setTaskTitle]    = useState('')
  const [taskDue,      setTaskDue]      = useState('')
  const [taskSaved,    setTaskSaved]    = useState(false)

  const { label, color } = STAGE_META[lead.stage]
  const pendingTasks = lead.tasks.filter(t => !t.done)

  const submitTask = () => {
    if (!taskTitle.trim()) return
    onCreateTask(taskTitle.trim(), taskDue || undefined)
    setTaskTitle('')
    setTaskDue('')
    setTaskSaved(true)
    setTimeout(() => {
      setTaskSaved(false)
      setShowTaskForm(false)
    }, 1500)
  }

  return (
    <div style={styles.wrap}>
      {/* Stage + ultima atividade */}
      <div style={styles.row}>
        <span style={{ ...styles.badge, background: color }}>{label}</span>
        {lead.lastInteraction && (
          <span style={styles.muted}>
            {new Date(lead.lastInteraction).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div style={styles.tagsWrap}>
          {lead.tags.map(tag => (
            <span key={tag} style={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      {/* Mudar estagio */}
      <div style={styles.field}>
        <label style={styles.label}>Atualizar estagio:</label>
        <select
          value={lead.stage}
          disabled={disableActions}
          onChange={e => onStageChange(e.target.value as LeadStageType)}
          style={styles.select}
        >
          {(Object.keys(STAGE_META) as LeadStageType[]).map(s => (
            <option key={s} value={s}>{STAGE_META[s].label}</option>
          ))}
        </select>
      </div>

      {/* Historico de campanhas */}
      {lead.campaigns.length > 0 && (
        <div style={styles.field}>
          <div style={styles.label}>Campanhas enviadas:</div>
          {lead.campaigns.slice(0, 3).map((c, i) => (
            <div key={i} style={styles.histRow}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={styles.muted}>
                {new Date(c.sentAt).toLocaleDateString('pt-BR')} | {c.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tarefas pendentes */}
      {pendingTasks.length > 0 && (
        <div style={styles.field}>
          <div style={styles.label}>Tarefas abertas:</div>
          {pendingTasks.map(task => (
            <div key={task.id} style={styles.taskRow}>
              {task.dueAt && (
                <span style={{ color: new Date(task.dueAt) < new Date() ? '#ef4444' : '#f59e0b', marginRight: 4 }}>
                  {new Date(task.dueAt).toLocaleDateString('pt-BR')}
                </span>
              )}
              {task.title}
            </div>
          ))}
        </div>
      )}

      {/* Acoes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {disableActions && (
          <div style={styles.warn}>
            Nao consegui capturar o numero deste chat ainda.
          </div>
        )}
        <button
          disabled={disableActions}
          onClick={() => onStageChange('QUOTE_REQUESTED')}
          style={btn('#2563eb', disableActions)}
        >
          Pediu cotacao
        </button>

        <button
          disabled={disableActions}
          onClick={() => setShowTaskForm(v => !v)}
          style={btn('#7c3aed', disableActions)}
        >
          {showTaskForm ? 'Fechar tarefa' : 'Criar tarefa de follow-up'}
        </button>

        {showTaskForm && !disableActions && (
          <div style={styles.formBox}>
            <input
              placeholder="Ex: Enviar proposta com seguro"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitTask()}
              style={styles.input}
            />
            <label style={{ ...styles.label, marginTop: 6 }}>Prazo (opcional):</label>
            <input
              type="date"
              value={taskDue}
              onChange={e => setTaskDue(e.target.value)}
              style={styles.input}
            />
            {taskSaved
              ? <div style={styles.savedMsg}>Tarefa salva!</div>
              : <button onClick={submitTask} style={{ ...btn('#7c3aed'), marginTop: 6 }}>Salvar</button>
            }
          </div>
        )}

        <button
          disabled={disableActions}
          onClick={() => {
            if (window.confirm(`Marcar ${contactName} como opt-out? Ela nao recebera mais mensagens.`)) {
              onBlock()
            }
          }}
          style={btn('#dc2626', disableActions)}
        >
          Bloquear (opt-out)
        </button>
      </div>
    </div>
  )
}

// --- Estilos inline (sem dependencia de CSS externo) ---
const styles = {
  wrap:     { padding: 12, fontSize: 13 } as React.CSSProperties,
  row:      { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } as React.CSSProperties,
  badge:    { color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 } as React.CSSProperties,
  muted:    { color: '#9ca3af', fontSize: 11 } as React.CSSProperties,
  tagsWrap: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 10 },
  tag:      { background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 10, fontSize: 11, color: '#374151' } as React.CSSProperties,
  field:    { marginBottom: 10 } as React.CSSProperties,
  label:    { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 } as React.CSSProperties,
  select:   { width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 } as React.CSSProperties,
  histRow:  { fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' } as React.CSSProperties,
  taskRow:  { fontSize: 11, padding: '3px 0', color: '#374151' } as React.CSSProperties,
  formBox:  { background: '#f9fafb', borderRadius: 6, padding: 10, border: '1px solid #e5e7eb' } as React.CSSProperties,
  input:    { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' as const, marginTop: 2 },
  savedMsg: { padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#166534', fontWeight: 700, marginTop: 6, textAlign: 'center' as const },
  warn:     { padding: '7px 10px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11, color: '#854d0e' } as React.CSSProperties,
}

const btn = (bg: string, disabled = false): React.CSSProperties => ({
  width: '100%', padding: '7px 12px', background: bg, color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})
