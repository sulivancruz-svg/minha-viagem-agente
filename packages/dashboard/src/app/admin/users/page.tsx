'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface User {
  id:             string
  name:           string
  email:          string
  whatsappNumber: string | null
  role:           string
  isActive:       boolean
  lastActiveAt:   string | null
  createdAt:      string
  _count:         { campaigns: number; tasks: number; sends: number; sendsReplied: number }
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-400'}`} />
      {active ? 'Ativo' : 'Suspenso'}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', cls: 'bg-purple-100 text-purple-700' },
    ADMIN:       { label: 'Admin',       cls: 'bg-blue-100 text-blue-700'   },
    AGENT:       { label: 'Agente',      cls: 'bg-gray-100 text-gray-600'   },
  }
  const { label, cls } = map[role] ?? { label: role, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [rotating, setRotating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newToken,  setNewToken]  = useState<{ userId: string; token: string } | null>(null)

  const load = () => {
    setLoading(true)
    api.adminListUsers()
      .then(data => setUsers((data as { users: User[] }).users))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (user: User) => {
    try {
      await api.adminUpdateUser(user.id, { isActive: !user.isActive })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
    } catch (e) {
      alert('Erro ao atualizar: ' + String(e))
    }
  }

  const rotateToken = async (userId: string) => {
    if (!confirm('Gerar novo token? O agente precisará atualizar na extensão.')) return
    setRotating(userId)
    try {
      const res = await api.adminRotateToken(userId) as { apiToken: string }
      setNewToken({ userId, token: res.apiToken })
    } catch (e) {
      alert('Erro: ' + String(e))
    } finally {
      setRotating(null)
    }
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`Excluir usuario "${user.name}"? Esta acao nao pode ser desfeita.`)) return
    setDeleting(user.id)
    try {
      await api.adminDeleteUser(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (e) {
      alert('Erro ao excluir: ' + String(e))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              Admin SaaS
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cada usuário = 1 número de WhatsApp. Gere e gerencie licenças aqui.
          </p>
        </div>
        <Link href="/admin/users/new" className="btn-primary">
          + Novo usuário
        </Link>
      </div>

      {/* Aviso de novo token */}
      {newToken && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
          <div className="font-bold text-yellow-800 mb-1">🔑 Novo token gerado</div>
          <div className="text-sm text-yellow-700 mb-2">
            Envie este token para o agente configurar na extensão Chrome:
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-white border border-yellow-200 rounded px-3 py-2 text-sm font-mono text-gray-800 break-all">
              {newToken.token}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(newToken.token); }}
              className="btn-secondary text-xs whitespace-nowrap"
            >
              Copiar
            </button>
          </div>
          <button
            onClick={() => setNewToken(null)}
            className="mt-2 text-xs text-yellow-600 underline"
          >
            Fechar
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">👤</div>
          <div className="font-semibold">Nenhum usuário cadastrado.</div>
          <Link href="/admin/users/new" className="inline-block mt-4 btn-primary">
            Criar primeiro usuário
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Agente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">WhatsApp</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Perfil</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Disparos</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Respostas</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Taxa</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ultimo acesso</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === users.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {user.whatsappNumber ? (
                      <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {user.whatsappNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">não vinculado</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-gray-900">{user._count.sends}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-green-600">{user._count.sendsReplied}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user._count.sends > 0 ? (
                      <span className={`text-xs font-bold ${
                        (user._count.sendsReplied / user._count.sends) >= 0.3 ? 'text-green-600' :
                        (user._count.sendsReplied / user._count.sends) >= 0.15 ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {Math.round((user._count.sendsReplied / user._count.sends) * 100)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={user.isActive} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {user.lastActiveAt
                      ? new Date(user.lastActiveAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Ativar / Suspender */}
                      {user.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => toggleActive(user)}
                          className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                            user.isActive
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {user.isActive ? 'Suspender' : 'Reativar'}
                        </button>
                      )}
                      {/* Rotacionar token */}
                      <button
                        onClick={() => rotateToken(user.id)}
                        disabled={rotating === user.id}
                        className="text-xs px-2 py-1 rounded font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                      >
                        {rotating === user.id ? '...' : '🔑 Token'}
                      </button>
                      {/* Metricas */}
                      <Link
                        href={`/admin/users/${user.id}/metrics`}
                        className="text-xs px-2 py-1 rounded font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                      >
                        Metricas
                      </Link>
                      <Link
                        href={`/admin/users/${user.id}#wa-qr`}
                        className="text-xs px-2 py-1 rounded font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        QR Code
                      </Link>
                      {/* Editar */}
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs px-2 py-1 rounded font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Editar
                      </Link>
                      {user.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => deleteUser(user)}
                          disabled={deleting === user.id}
                          className="text-xs px-2 py-1 rounded font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {deleting === user.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumo */}
      {!loading && users.length > 0 && (
        <div className="mt-4 flex gap-6 text-sm text-gray-500">
          <span>{users.length} usuário{users.length !== 1 ? 's' : ''} total</span>
          <span>{users.filter(u => u.isActive).length} ativo{users.filter(u => u.isActive).length !== 1 ? 's' : ''}</span>
          <span>{users.filter(u => !u.isActive).length} suspenso{users.filter(u => !u.isActive).length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}
