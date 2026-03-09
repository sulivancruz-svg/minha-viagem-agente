import type { Metadata } from 'next'
import { AppShell } from '@/components/AppShell'
import './globals.css'

export const metadata: Metadata = {
  title:       'Minha Viagem - Agente de Vendas',
  description: 'CRM e painel de vendas para agentes de viagem via WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
