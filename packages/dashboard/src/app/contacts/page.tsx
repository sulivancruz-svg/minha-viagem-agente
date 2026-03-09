'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

interface Contact {
  id: string; name: string; phoneE164: string; tags?: string[] | null
  optInStatus: string; blocked: boolean; createdAt: string
  leadStage?: { stage: string }
}

const OPT_IN_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  BLOCKED:   'bg-red-100    text-red-700',
}

const STAGE_LABELS: Record<string, string> = {
  NEW: 'Novo', CONTACTED: 'Contatado', QUOTE_REQUESTED: 'Cotacao',
  PROPOSAL_SENT: 'Proposta', CLOSED_WON: 'Fechado', CLOSED_LOST: 'Perdido', OPTED_OUT: 'Opt-out',
}

export default function ContactsPage() {
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [optIn,    setOptIn]    = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{created:number;skipped:number;errors:number}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (params?: Record<string, string>) => {
    setLoading(true)
    api.getContacts(params)
      .then(({ contacts: c, total: t }) => {
        const normalized = (c as Contact[]).map(contact => ({
          ...contact,
          tags: Array.isArray(contact.tags) ? contact.tags : [],
        }))
        setContacts(normalized)
        setTotal(t)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const phone = searchParams.get('phone')
    if (phone) {
      setSearch(phone)
      load({ search: phone })
      return
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load({ ...(search && { search }), ...(optIn && { optIn }) })
  }

  // Importa CSV via File input
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const text = await file.text()
    const lines = text.split('\n').filter(Boolean)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
    try {
      const result = await api.importContacts(rows)
      setImportResult(result)
      load()
    } catch (e) {
      alert('Erro ao importar: ' + String(e))
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Anonimizar dados de "${name}"? (LGPD)`)) return
    await api.deleteContact(id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Contatos</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString('pt-BR')} contatos na base</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn-secondary"
          >
            {importing ? 'Importando...' : '📥 Importar CSV'}
          </button>
        </div>
      </div>

      {/* Resultado do import */}
      {importResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
          <span>Importado: {importResult.created} novos, {importResult.skipped} ja existiam, {importResult.errors} erros.</span>
          <button onClick={() => setImportResult(null)} className="text-green-600 hover:text-green-800">x</button>
        </div>
      )}

      {/* Dica formato CSV */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        Formato CSV esperado: <code>name, phone, tags, opt_in, opt_in_source</code><br />
        Exemplo: <code>Maria Silva, 5511999990001, interesse_europa|familia, CONFIRMED, landing_page</code>
      </div>

      {/* Filtros */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="input flex-1 max-w-xs"
        />
        <select value={optIn} onChange={e => setOptIn(e.target.value)} className="input w-40">
          <option value="">Todos opt-ins</option>
          <option value="CONFIRMED">Confirmado</option>
          <option value="PENDING">Pendente</option>
          <option value="BLOCKED">Bloqueado</option>
        </select>
        <button type="submit" className="btn-primary">Filtrar</button>
      </form>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              {['Nome', 'Telefone', 'Opt-in', 'Estagio', 'Tags', 'Acoes'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({length:5}).map((_,i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-4 animate-pulse bg-gray-50 h-10" /></tr>
              ))
            ) : contacts.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.phoneE164}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${OPT_IN_COLORS[c.optInStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.optInStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {STAGE_LABELS[c.leadStage?.stage ?? 'NEW'] ?? c.leadStage?.stage ?? 'Novo'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags ?? []).slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    className="text-xs text-red-500 hover:text-red-700"
                    title="Anonimizar (LGPD)"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && contacts.length === 0 && (
          <div className="py-12 text-center text-gray-400">Nenhum contato encontrado.</div>
        )}
      </div>
    </div>
  )
}
