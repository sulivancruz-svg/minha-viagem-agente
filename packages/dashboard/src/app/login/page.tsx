'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(email, password)
      localStorage.setItem('mv_token', res.token)
      localStorage.setItem('mv_user', JSON.stringify(res.user))
      if (res.apiToken) localStorage.setItem('mv_api_token', res.apiToken)
      window.location.href = '/'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-800 to-teal-950">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        {/* Logo / Titulo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-700 rounded-xl mb-3">
            <span className="text-white text-2xl font-bold">MV</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Minha Viagem</h1>
          <p className="text-sm text-gray-500">Agente de Vendas</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-400 text-white font-semibold rounded-lg transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          v1.0.0 &mdash; SaaS
        </p>
      </div>
    </div>
  )
}
