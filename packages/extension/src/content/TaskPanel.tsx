import React from 'react'
import type { Task } from '../shared/types'

interface Props {
  tasks:      Task[]
  onComplete: (taskId: string) => void
}

export function TaskPanel({ tasks, onComplete }: Props) {
  const pending = tasks.filter(t => !t.done)
  const done    = tasks.filter(t => t.done)

  if (tasks.length === 0) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
        Nenhuma tarefa para este contato.
      </div>
    )
  }

  const isOverdue = (dueAt?: string) => dueAt && new Date(dueAt) < new Date()

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      {pending.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <div style={sectionTitle}>Pendentes ({pending.length})</div>
          {pending.map(task => (
            <div key={task.id} style={{ ...taskRow, borderLeft: `3px solid ${isOverdue(task.dueAt) ? '#dc2626' : '#f59e0b'}` }}>
              <input
                type="checkbox"
                checked={false}
                onChange={() => onComplete(task.id)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#111827' }}>{task.title}</div>
                {task.dueAt && (
                  <div style={{ fontSize: 11, color: isOverdue(task.dueAt) ? '#dc2626' : '#6b7280', marginTop: 2 }}>
                    {isOverdue(task.dueAt) ? 'Vencida: ' : 'Ate: '}
                    {new Date(task.dueAt).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <div style={sectionTitle}>Concluidas ({done.length})</div>
          {done.map(task => (
            <div key={task.id} style={{ padding: '5px 8px', color: '#9ca3af', textDecoration: 'line-through', fontSize: 12 }}>
              {task.title}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 6,
}
const taskRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '8px 10px', background: '#fff',
  border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 5,
}
