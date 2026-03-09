'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function NewUserPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name:           '',
    email:          '',
    password:       '',
    whatsappNumber: '',
    role:           'AGENT' as 'AGENT' | 'ADMIN',
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [created, setCreated] = useState<{ name: string; email: string; apiToken: string; whatsappNumber: string | null } | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name:     form.name,
        email:    form.email,
        password: form.password,
        role:     form.role,
      }
      if (form.whatsappNumber.trim()) {
        payload.whatsappNumber = form.whatsappNumber.trim()
      }
      const res = await api.adminCreateUser(payload) as typeof created
      setCreated(res)
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // ── Tela de sucesso ────────────────────────────────────────
  if (created) {
    return (
      <div className="p-8 max-w-lg">
        <div className="card p-6 border-green-200 bg-green-50">
          <div className="text-2xl mb-2">🎉</div>
          <h2 className="text-lg font-extrabold text-green-800 mb-1">Usuário criado com sucesso!</h2>
          <p className="text-sm text-green-700 mb-4">
            Envie as informações abaixo para <strong>{created.name}</strong> configurar a extensão Chrome.
          </p>
          <div className="space-y-3 bg-white rounded-xl p-4 border border-green-200">
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">E-mail</div>
              <div className="font-mono text-sm text-gray-800">{created.email}</div>
            </div>
            {created.whatsappNumber && (
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">WhatsApp vinculado</div>
                <div className="font-mono text-sm text-gray-800">{created.whatsappNumber}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">
                🔑 Token da API (para a extensão)
              </div>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono text-gray-800 break-all">
                  {created.apiToken}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(created!.apiToken)}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded p-2 mt-2">
                ⚠️ Guarde este token agora. Por segurança, ele não é exibido novamente — mas pode ser regenerado a qualquer momento.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => { setCreated(null); setForm({ name: '', email: '', password: '', whatsappNumber: '', role: 'AGENT' }) }}
              className="btn-secondary flex-1"
            >
              Criar outro
            </button>
            <Link href="/admin/users" className="btn-primary flex-1 text-center">
              Ver todos os usuários
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulário ─────────────────────────────────────────────
  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3">
          ← Voltar
        </Link>
        <div className="text-xs font-semibold uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-0.5 rounded inline-block mb-1">
          Admin SaaS
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Novo Usuário</h1>
        <p className="text-sm text-gray-500 mt-1">
          Crie uma conta para um agente ou agência. Um número de WhatsApp = uma licença.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">Nome completo *</label>
          <input className="input" value={form.name} onChange={set('name')} required placeholder="Ex: João Silva" />
        </div>

        <div>
          <label className="label">E-mail *</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} required placeholder="agente@exemplo.com" />
        </div>

        <div>
          <label className="label">Senha inicial *</label>
          <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} placeholder="mínimo 8 caracteres" />
          <p className="text-xs text-gray-400 mt-1">O agente pode trocar depois no perfil.</p>
        </div>

        <div>
          <label className="label">
            Número de WhatsApp (licença)
            <span className="text-gray-400 font-normal ml-1">— opcional</span>
          </label>
          <input
            className="input font-mono"
            value={form.whatsappNumber}
            onChange={set('whatsappNumber')}
            placeholder="+5511999999999"
          />
          <p className="text-xs text-gray-400 mt-1">
            Formato E.164 — código do país + DDD + número. Um número por conta.
          </p>
        </div>

        <div>
          <label className="label">Perfil *</label>
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="AGENT">Agente</option>
            <option value="ADMIN">Admin de Agência</option>
          </select>
        </div>

        <div className="pt-2">
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  )
}
