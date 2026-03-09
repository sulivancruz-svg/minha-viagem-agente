// Seed inicial: cria super admin, agente de exemplo e campanha demo
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Super Admin (dono da plataforma SaaS) ─────────────────
  const superAdminHash = await bcrypt.hash('superadmin123', 12)
  const superAdmin = await prisma.user.upsert({
    where:  { email: 'admin@minhaviagem.com.br' },
    update: {},
    create: {
      email:          'admin@minhaviagem.com.br',
      name:           'Super Admin',
      passwordHash:   superAdminHash,
      apiToken:       randomUUID(),
      role:           'SUPER_ADMIN',
      isActive:       true,
    },
  })
  console.log(`✅ Super Admin: ${superAdmin.email} | senha: superadmin123`)

  // ── Agente de exemplo ─────────────────────────────────────
  const agentHash = await bcrypt.hash('agente123', 12)
  const agent = await prisma.user.upsert({
    where:  { email: 'agente@exemplo.com' },
    update: {},
    create: {
      email:          'agente@exemplo.com',
      name:           'Agente Exemplo',
      passwordHash:   agentHash,
      apiToken:       randomUUID(),
      whatsappNumber: '+5511999990001',
      role:           'AGENT',
      isActive:       true,
    },
  })
  console.log(`✅ Agente demo: ${agent.email} | WhatsApp: ${agent.whatsappNumber}`)

  // ── Campanha de exemplo ───────────────────────────────────
  await prisma.campaign.upsert({
    where:  { id: 'demo-campanha-1' },
    update: {},
    create: {
      id:          'demo-campanha-1',
      name:        'Cancun Julho 2025',
      destination: 'Cancun, Mexico',
      dateRange:   '05 a 12 de julho de 2025',
      offerText:   'Pacote completo com voo, hotel 5 estrelas all-inclusive e traslados.',
      inclusions:  JSON.stringify(['Voo ida e volta', 'Hotel 5 estrelas all-inclusive', 'Traslados aeroporto', 'Seguro viagem']),
      priceFrom:   4890,
      ctaText:     'Quero receber a cotacao completa!',
      landingUrl:  'https://minhaviagem.app/cancun-julho',
      isActive:    true,
      createdById: agent.id,
    },
  })
  console.log('✅ Campanha demo criada.')

  console.log('\n🎉 Seed concluído!')
  console.log('─────────────────────────────────────────')
  console.log('Super Admin → admin@minhaviagem.com.br / superadmin123')
  console.log('Agente demo → agente@exemplo.com       / agente123')
  console.log('─────────────────────────────────────────')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
