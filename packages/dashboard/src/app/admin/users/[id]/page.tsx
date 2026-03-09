'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface UserDetail {
  id:             string
  name:           string
  email:          string
  whatsappNumber: string | null
  apiToken:       string
  role:           string
  isActive:       boolean
}

interface WaAdminStatus {
  ok: boolean
  started: boolean
  authenticated: boolean
  ready: boolean
  qrAvailable: boolean
  qrDataUrl: string | null
  qrFilePath: string | null
  lastError: string | null
  lastEvent: string | null
  lastEventAt: string | null
}

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [user,    setUser]    = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({ name: '', whatsappNumber: '', role: 'AGENT', isActive: true })

  useEffect(() => {
    api.adminGetUser(id)
      .then(u => {
        const data = u as UserDetail
        setUser(data)
        setForm({
          name:           data.name,
          whatsappNumber: data.whatsappNumber ?? '',
          role:           data.role,
          isActive:       data.isActive,
        })
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload: Record<string, unknown> = {
        name:     form.name,
        isActive: form.isActive,
        role:     form.role,
      }
      payload.whatsappNumber = form.whatsappNumber.trim() || null
      await api.adminUpdateUser(id, payload)
      setSuccess('Dados salvos com sucesso!')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const [rotating, setRotating] = useState(false)
  const [newToken,  setNewToken]  = useState('')
  const [waStatus, setWaStatus] = useState<WaAdminStatus | null>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [waStarting, setWaStarting] = useState(false)
  const [waPolling, setWaPolling] = useState(false)

  const rotateToken = async () => {
    if (!confirm('Gerar novo token? O agente precisará atualizar na extensão Chrome.')) return
    setRotating(true)
    try {
      const res = await api.adminRotateToken(id) as { apiToken: string }
      setNewToken(res.apiToken)
      setUser(prev => prev ? { ...prev, apiToken: res.apiToken } : prev)
    } catch (e) {
      setError(String(e))
    } finally {
      setRotating(false)
    }
  }

  const refreshWaStatus = async () => {
    setWaLoading(true)
    try {
      const status = await api.adminUserWaStatus(id) as WaAdminStatus
      setWaStatus(status)
    } catch (e) {
      setError(String(e))
    } finally {
      setWaLoading(false)
    }
  }

  const startWaSession = async () => {
    setWaStarting(true)
    setError('')
    try {
      const status = await api.adminUserWaStart(id, { forceNew: true }) as WaAdminStatus
      setWaStatus(status)
      setSuccess('Nova sessao WhatsApp iniciada. Aguardando QR Code...')
      setWaPolling(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setWaStarting(false)
    }
  }

  useEffect(() => {
    refreshWaStatus().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!waPolling) return
    let canceled = false
    let ticks = 0
    const timer = window.setInterval(async () => {
      if (canceled) return
      ticks += 1
      try {
        const status = await api.adminUserWaStatus(id) as WaAdminStatus
        if (canceled) return
        setWaStatus(status)
        if (status.ready) {
          setSuccess('Sessao conectada e pronta para disparos.')
          setWaPolling(false)
          return
        }
        if (status.qrDataUrl) {
          setSuccess('QR gerado. Escaneie com o celular do usuario.')
          setWaPolling(false)
          return
        }
      } catch {
        // ignora erro transitório e continua polling até timeout
      }
      if (ticks >= 30) {
        setWaPolling(false)
      }
    }, 2000)

    return () => {
      canceled = true
      window.clearInterval(timer)
    }
  }, [id, waPolling])

  if (loading) return <div className="p-8 text-gray-400">Carregando...</div>
  if (!user)   return <div className="p-8 text-red-500">Usuário não encontrado.</div>

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3">
          ← Voltar para usuários
        </Link>
        <div className="text-xs font-semibold uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-0.5 rounded inline-block mb-1">
          Admin SaaS
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">Editar Usuário</h1>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
      </div>

      {error   && <div className="mb-4 p-3 bg-red-50  border border-red-200  rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

      {/* Formulário */}
      <form onSubmit={handleSave} className="card p-6 space-y-4 mb-4">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={form.name} onChange={set('name')} required />
        </div>

        <div>
          <label className="label">WhatsApp (licença)</label>
          <input className="input font-mono" value={form.whatsappNumber} onChange={set('whatsappNumber')} placeholder="+5511999999999" />
          <p className="text-xs text-gray-400 mt-1">Formato E.164. Deixe vazio para desvincular.</p>
        </div>

        <div>
          <label className="label">Perfil</label>
          <select className="input" value={form.role} onChange={set('role')} disabled={user.role === 'SUPER_ADMIN'}>
            <option value="AGENT">Agente</option>
            <option value="ADMIN">Admin de Agência</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="isActive"
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
            disabled={user.role === 'SUPER_ADMIN'}
            className="w-4 h-4 accent-green-600"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">
            Conta ativa (licença válida)
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>

      {/* Token da API */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-900 mb-3">🔑 Token da extensão</h2>
        <p className="text-xs text-gray-500 mb-3">
          Este token é usado na extensão Chrome para autenticar o agente.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono text-gray-700 break-all">
            {newToken || user.apiToken}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(newToken || user.apiToken)}
            className="btn-secondary text-xs whitespace-nowrap"
          >
            Copiar
          </button>
        </div>
        {newToken && (
          <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-100 rounded p-2 mb-3">
            ⚠️ Token renovado! Informe o novo token para o agente.
          </div>
        )}
        <button
          onClick={rotateToken}
          disabled={rotating}
          className="w-full text-sm py-2 rounded-lg border border-yellow-300 text-yellow-700 hover:bg-yellow-50 transition-colors font-medium disabled:opacity-50"
        >
          {rotating ? 'Gerando...' : 'Gerar novo token'}
        </button>
      </div>

      <div id="wa-qr" className="card p-6 mt-4">
        <h2 className="font-bold text-gray-900 mb-3">WhatsApp Web (QR Code)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Inicie a sessao deste usuario e escaneie o QR no celular dele.
        </p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={startWaSession}
            disabled={waStarting}
            className="btn-primary text-sm"
          >
            {waStarting ? 'Gerando QR...' : 'Gerar novo QR'}
          </button>
          <button
            onClick={refreshWaStatus}
            disabled={waLoading || waPolling}
            className="btn-secondary text-sm"
          >
            {waPolling ? 'Aguardando QR...' : waLoading ? 'Atualizando...' : 'Atualizar status'}
          </button>
        </div>

        {waStatus && (
          <div className="text-xs text-gray-700 space-y-1 mb-3">
            <div><strong>started:</strong> {String(waStatus.started)}</div>
            <div><strong>authenticated:</strong> {String(waStatus.authenticated)}</div>
            <div><strong>ready:</strong> {String(waStatus.ready)}</div>
            <div><strong>lastEvent:</strong> {waStatus.lastEvent ?? '-'}</div>
            <div><strong>lastError:</strong> {waStatus.lastError ?? '-'}</div>
          </div>
        )}

        {waStatus?.qrDataUrl && !waStatus.ready && (
          <div className="mt-2">
            <img
              src={waStatus.qrDataUrl}
              alt="QR Code WhatsApp Web"
              className="w-72 h-72 object-contain border border-gray-200 rounded-lg bg-white p-2"
            />
            <p className="text-xs text-gray-500 mt-2">
              Este QR expira rapido. Se expirar, clique em "Gerar QR Code" novamente.
            </p>
          </div>
        )}

        {waStatus?.ready && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
            Sessao conectada e pronta para disparos.
          </div>
        )}
      </div>
    </div>
  )
}
