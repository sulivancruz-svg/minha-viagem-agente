// Sugestoes de resposta via LLM
// MVP: regras locais. Producao: OpenAI / Claude via API.

import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const SuggestSchema = z.object({
  lastMessage:  z.string().min(1),
  contactName:  z.string().default('Viajante'),
  campaignId:   z.string().optional(),
})

// POST /api/ai/suggest-reply
router.post('/suggest-reply', requireAuth, async (req, res, next) => {
  try {
    const { lastMessage, contactName, campaignId } = SuggestSchema.parse(req.body)

    let suggestions: string[]

    // Tenta LLM se configurado
    if (process.env.OPENAI_API_KEY) {
      suggestions = await suggestWithLLM(lastMessage, contactName, campaignId)
    } else {
      // Fallback: regras locais
      suggestions = suggestWithRules(lastMessage, contactName)
    }

    return res.json({ suggestions })
  } catch (e) { next(e) }
})

// Sugestao por regras (sem custo, sem latencia)
function suggestWithRules(text: string, name: string): string[] {
  const first = name.split(' ')[0]

  if (/\b(sair|stop|parar|nao quero)\b/i.test(text)) {
    return [
      `Tudo bem, ${first}. Vou remover voce da lista. Qualquer duvida no futuro, estou disponivel. Tenha um otimo dia!`,
      `Entendido! Nao enviarei mais mensagens. Se mudar de ideia sobre viajar, pode me chamar quando quiser.`,
    ]
  }
  if (/\b(cotar?|preco|valor|quanto|orcamento)\b/i.test(text)) {
    return [
      `Oi, ${first}! Fico feliz com seu interesse. Para montar a cotacao, me informa: quantas pessoas viajam e as datas preferidas?`,
      `Claro, vou preparar a proposta! Datas fixas ou flexiveis? E o numero de pessoas adultos e criancas?`,
      `Perfeito! Preciso de 3 informacoes: numero de pessoas, datas de ida e volta, e se prefere voo incluso. Pode me passar?`,
    ]
  }
  if (/\b(duvida|pergunta|como|quando|onde|pode|tem)\b/i.test(text)) {
    return [
      `Oi, ${first}! Claro, pode perguntar. Estou aqui para ajudar.`,
      `Boa pergunta! Me conta mais sobre sua duvida para eu te dar a melhor resposta.`,
    ]
  }
  if (/\b(comprei|paguei|fiz a reserva|ja comprei)\b/i.test(text)) {
    return [
      `Parabens pela viagem, ${first}! Se precisar de dicas, informacoes sobre documentos ou passeios, pode me chamar.`,
      `Excelente escolha! Qualquer duvida sobre bagagem, roteiro ou seguro viagem, estou disponivel.`,
    ]
  }

  return [
    `Oi, ${first}! Posso te ajudar com mais informacoes sobre a viagem?`,
    `Obrigado pela mensagem! Tem algo em que posso ajudar?`,
  ]
}

// Sugestao via OpenAI (opcional)
async function suggestWithLLM(text: string, name: string, campaignId?: string): Promise<string[]> {
  let context = ''
  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } }).catch(() => null)
    if (campaign) {
      context = `Campanha atual: ${campaign.name} - ${campaign.destination} (${campaign.dateRange}). Preco a partir de R$ ${campaign.priceFrom}.`
    }
  }

  const prompt = [
    'Voce e um agente de viagens amigavel e profissional.',
    context ? `Contexto: ${context}` : '',
    `Contato: ${name}`,
    `Ultima mensagem recebida: "${text}"`,
    '',
    'Gere 2-3 sugestoes de resposta curtas, diretas e humanas (max 2 linhas cada).',
    'Sempre inclua opt-out se o contato demonstrar desinteresse.',
    'Responda em formato JSON: {"suggestions": ["...", "...", "..."]}',
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:       process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages:    [{ role: 'user', content: prompt }],
      max_tokens:  300,
      temperature: 0.7,
    }),
  })

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const content = data.choices?.[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content.replace(/```json\n?|```/g, '').trim())
  return parsed.suggestions ?? suggestWithRules(text, name)
}

export default router
