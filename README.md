# Minha Viagem — Agente de Vendas

Sistema híbrido de CRM para agentes de viagem, composto por:

- **Extensão Chrome MV3** — painel lateral injetado no WhatsApp Web para captura de leads, sugestão de respostas e envio assistido de campanhas (o agente clica em "Enviar" manualmente).
- **Backend Node.js/Express** — API REST com integração à WhatsApp Business Cloud API, fila de envio com rate-limiting, webhooks de status e armazenamento de PII com criptografia.
- **Dashboard Next.js** — gestão de campanhas, contatos (com importação CSV), métricas e funil de vendas.

---

## Árvore do repositório

```
minha-viagem-agente/
├── package.json                  # raiz do monorepo (pnpm workspaces)
├── .gitignore
├── README.md
│
├── packages/
│   ├── extension/                # Extensão Chrome MV3
│   │   ├── manifest.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── src/
│   │       ├── shared/
│   │       │   ├── types.ts      # interfaces compartilhadas
│   │       │   ├── storage.ts    # wrapper Chrome storage (com cache)
│   │       │   └── api.ts        # cliente HTTP autenticado
│   │       ├── background/
│   │       │   └── index.ts      # Service Worker MV3
│   │       ├── content/
│   │       │   ├── hooks/
│   │       │   │   └── useCurrentChat.ts
│   │       │   ├── LeadCard.tsx
│   │       │   ├── CampaignSender.tsx
│   │       │   ├── SuggestedReply.tsx
│   │       │   ├── TaskPanel.tsx
│   │       │   ├── SidePanel.tsx
│   │       │   └── index.tsx     # entry point do content script
│   │       └── popup/
│   │           ├── index.html
│   │           ├── index.tsx
│   │           └── Popup.tsx
│   │
│   ├── backend/                  # API Express + Prisma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── jwt.ts
│   │       │   ├── crypto.ts     # AES-256-CBC para PII
│   │       │   ├── whatsapp.ts   # cliente Cloud API
│   │       │   └── queue.ts      # fila em memória com rate-limit
│   │       ├── middleware/
│   │       │   ├── auth.ts       # JWT + apiToken estático
│   │       │   └── errorHandler.ts
│   │       ├── routes/
│   │       │   ├── auth.ts       # POST /login, GET /me, POST /rotate-token
│   │       │   ├── contacts.ts   # CRUD + importação CSV + opt-out
│   │       │   ├── campaigns.ts  # CRUD
│   │       │   ├── sends.ts      # dispatch (dry-run) + assisted
│   │       │   ├── webhooks.ts   # eventos Cloud API
│   │       │   ├── metrics.ts    # funil + timeline + overview
│   │       │   ├── tasks.ts      # tarefas
│   │       │   ├── events.ts     # log de eventos
│   │       │   └── ai.ts         # sugestão de resposta (LLM ou regras)
│   │       └── index.ts          # servidor Express
│   │
│   └── dashboard/                # Dashboard Next.js 14
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.js
│       └── src/
│           ├── lib/
│           │   └── api.ts
│           ├── components/
│           │   └── Sidebar.tsx
│           └── app/
│               ├── globals.css
│               ├── layout.tsx
│               ├── page.tsx              # Visão Geral
│               ├── campaigns/
│               │   ├── page.tsx          # lista
│               │   └── new/page.tsx      # formulário
│               ├── contacts/
│               │   └── page.tsx          # tabela + CSV import
│               └── metrics/
│                   └── page.tsx          # funil + charts
```

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 20 LTS |
| pnpm | 8+ |
| PostgreSQL | 15+ |
| Google Chrome | 120+ |

> Opcional para Track 2: conta Meta Business com acesso à **WhatsApp Business Cloud API** e número de telefone verificado.

---

## Setup passo a passo

### 1. Clonar e instalar dependências

```bash
git clone <url-do-repo> minha-viagem-agente
cd minha-viagem-agente
pnpm install
```

### 2. Configurar variáveis de ambiente (Backend)

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edite `packages/backend/.env` com seus valores:

```env
# Banco de dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/minha_viagem"

# JWT (gere com: openssl rand -hex 32)
JWT_SECRET="sua-chave-jwt-aqui"
JWT_EXPIRES_IN="7d"

# Criptografia de PII (AES-256 — exatamente 32 bytes em hex = 64 chars)
ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

# WhatsApp Business Cloud API (Track 2 — deixe em branco para Track 1)
WA_PHONE_NUMBER_ID=""
WA_ACCESS_TOKEN=""
WA_WEBHOOK_VERIFY_TOKEN=""
WA_APP_SECRET=""

# Limites de envio (seguir políticas Meta)
WA_DAILY_LIMIT=1000
WA_RATE_LIMIT_PER_MINUTE=20

# OpenAI para sugestão de respostas (opcional)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"

# CORS — origens permitidas (dashboard e extensão)
CORS_ORIGINS="http://localhost:3000"

PORT=3001
NODE_ENV=development
```

> **Segurança**: nunca commite o `.env` com valores reais. O `.gitignore` já exclui esses arquivos.

### 3. Criar banco de dados e rodar migrações

```bash
# Cria o banco no PostgreSQL (se ainda não existir)
createdb minha_viagem

# Aplica o schema Prisma
pnpm db:migrate

# Popula dados iniciais (usuário admin + campanha de exemplo)
pnpm db:seed
```

Credenciais do usuário admin criado pelo seed:

```
E-mail: admin@minhaviagem.com
Senha:  admin123
```

> Troque a senha imediatamente em produção.

### 4. Iniciar servidores em modo de desenvolvimento

Em terminais separados (ou usando um multiplexador como tmux):

```bash
# Backend (porta 3001)
pnpm dev:backend

# Dashboard (porta 3000)
pnpm dev:dashboard
```

### 5. Compilar a extensão Chrome

```bash
# Build único
pnpm build:extension

# Ou em modo watch (recompila ao salvar)
cd packages/extension
pnpm dev
```

O artefato compilado estará em `packages/extension/dist/`.

### 6. Carregar a extensão no Chrome

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `packages/extension/dist/`
5. A extensão "Minha Viagem" aparecerá na barra de ferramentas

### 7. Configurar a extensão

1. Clique no ícone da extensão → Popup
2. Preencha **URL da API**: `http://localhost:3001`
3. Obtenha seu `apiToken`:

```bash
# No dashboard, faça login e acesse /api/auth/me
# Ou consulte diretamente no banco:
pnpm --filter backend db:studio
```

4. Preencha **Token da API** → **Salvar**
5. O status deve ficar verde ("Conectado")

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev:backend` | Backend em modo watch (tsx) |
| `pnpm dev:dashboard` | Dashboard Next.js em dev |
| `pnpm build:extension` | Build da extensão para `dist/` |
| `pnpm build:all` | Build de todos os pacotes |
| `pnpm db:migrate` | Aplica migrações Prisma |
| `pnpm db:generate` | Regenera o Prisma Client |
| `pnpm db:seed` | Popula dados iniciais |
| `pnpm db:studio` | Abre o Prisma Studio (UI do banco) |

---

## Plano de implementação

### Track 1 — Envio Assistido (sem Cloud API)

Funcional com apenas o backend local e a extensão. Não requer conta Meta.

- [x] Detecção de chat ativo no WhatsApp Web
- [x] Painel lateral com dados do lead
- [x] Atualização de estágio do funil
- [x] Sugestão de resposta baseada em regras
- [x] Preenchimento da caixa de digitação (usuário clica "Enviar")
- [x] Log de evento de envio assistido (`/api/sends/assisted`)
- [x] Gestão de tarefas por contato
- [x] Importação de contatos via CSV
- [x] Dashboard com funil e métricas básicas

### Track 2 — Envio em Escala via Cloud API

Requer conta Meta Business, número verificado e templates aprovados.

- [ ] Configurar `WA_PHONE_NUMBER_ID` e `WA_ACCESS_TOKEN` no `.env`
- [ ] Criar e aprovar templates de mensagem no Meta Business Manager
- [ ] Configurar webhook no Meta: `https://seu-dominio.com/api/webhooks/whatsapp`
- [ ] Testar envio de template via `POST /api/sends/dispatch` com `dryRun: true`
- [ ] Confirmar volume e disparar campanha real
- [ ] Monitorar status de entrega/leitura no dashboard

---

## Checklist de testes

### Unitários

- [ ] `src/lib/crypto.ts` — `encrypt(decrypt(x)) === x` para strings com caracteres especiais
- [ ] `src/lib/whatsapp.ts` — `verifyWebhookSignature()` rejeita payload adulterado
- [ ] `src/lib/queue.ts` — respeita `WA_RATE_LIMIT_PER_MINUTE`, não ultrapassa `WA_DAILY_LIMIT`
- [ ] `src/routes/sends.ts` — dispatch rejeita contatos sem `optInStatus: CONFIRMED`
- [ ] `src/routes/sends.ts` — dry-run não cria registros no banco
- [ ] `src/routes/contacts.ts` — importação CSV normaliza números para E.164 (`+55...`)
- [ ] `src/routes/contacts.ts` — DELETE anonimiza PII sem apagar o registro
- [ ] Extension `storage.ts` — TTL de 5 minutos expira o cache corretamente

### Integração (com banco real)

- [ ] `POST /api/auth/login` retorna JWT válido
- [ ] `GET /api/auth/me` com JWT inválido retorna 401
- [ ] `POST /api/contacts` + `GET /api/contacts/by-phone/:phone` encontra o mesmo registro
- [ ] `PATCH /api/contacts/:id/stage` atualiza `LeadStage.stage` e cria `ConversationEvent`
- [ ] `POST /api/contacts/:id/block` seta `blocked = true` e cria evento `OPT_OUT`
- [ ] `GET /api/metrics/funnel` retorna todos os estágios do enum
- [ ] `GET /api/metrics/timeline?days=7` retorna exatamente 7 registros

### Roteiro manual — WhatsApp Web

1. **Instalar extensão** → abrir [https://web.whatsapp.com](https://web.whatsapp.com)
2. Verificar que o **painel lateral aparece** à direita sem sobrepor o chat
3. Abrir uma conversa → confirmar que o **nome e telefone** são detectados corretamente
4. Com contato não cadastrado: confirmar que o card mostra "Não encontrado" e botão de criação
5. Adicionar o contato manualmente no dashboard → voltar à extensão → **atualizar lead**
6. Mudar estágio para "Pediu Cotação" → verificar no dashboard que mudou
7. Na aba **Campanha**: selecionar campanha ativa → clicar "Preparar envio" → confirmar que o texto aparece na caixa de digitação do WhatsApp **sem ser enviado automaticamente**
8. Clicar em "Enviar" manualmente no WhatsApp → confirmar que o evento é logado via `/api/sends/assisted`
9. Enviar a mensagem "SAIR" no chat → verificar que o webhook/extensão marca o contato como `blocked`
10. Na aba **Sugestões**: receber uma mensagem de inbound → confirmar que a intenção é detectada e sugestões aparecem → selecionar uma → verificar que preenche a caixa sem enviar
11. Na aba **Tarefas**: criar tarefa → marcar como concluída → verificar atualização no dashboard
12. No **Dashboard > Métricas**: confirmar que os dados do teste aparecem no funil e na timeline

---

## Observações de segurança

### Proteção de tokens

- O `JWT_SECRET` deve ter no mínimo 256 bits de entropia. Gere com: `openssl rand -hex 32`
- O `apiToken` da extensão é um UUID v4 rotacionável via `POST /api/auth/rotate-token`
- Tokens são armazenados em `chrome.storage.local` — não acessível por content scripts de outras páginas
- Nunca logue tokens em produção; o `errorHandler` omite detalhes sensíveis em `NODE_ENV=production`

### Permissões mínimas da extensão

O `manifest.json` usa o conjunto mínimo:
- `storage` — para configurações e cache de leads
- `scripting` — para injeção do content script
- `activeTab` — sem acesso permanente a todas as abas
- `alarms` — para sync periódico de campanhas

O host permission é restrito a `https://web.whatsapp.com/*` e `http://localhost:3001/*` (dev).

### Proteção de PII

- E-mails são armazenados criptografados com AES-256-CBC (`encryptedEmail`)
- A chave de criptografia (`ENCRYPTION_KEY`) nunca vai ao banco; fica só no ambiente do servidor
- O `DELETE /api/contacts/:id` **anonimiza** em vez de apagar (mantém auditoria, remove PII)
- CSV imports não retornam e-mails em texto claro nas respostas da API
- Logs de erro não incluem o payload completo da requisição

### Envio responsável (anti-spam / LGPD)

- **Opt-in obrigatório**: o dispatch ignora contatos sem `optInStatus = CONFIRMED`
- **Opt-out automático**: palavras-chave `SAIR`, `STOP`, `PARAR`, `CANCELAR`, `DESCADASTRAR` nos webhooks bloqueiam o contato imediatamente
- **Confirmação de volume**: o dispatch exige `confirmedVolume === contacts.length`; evita disparos acidentais
- **Rate limit**: `WA_RATE_LIMIT_PER_MINUTE` (padrão: 20) + `WA_DAILY_LIMIT` (padrão: 1000) com jitter para evitar picos
- **Sem envio automatizado**: a extensão apenas preenche a caixa de texto — o agente sempre confirma o envio

### Webhook

- Assinatura HMAC-SHA256 (`X-Hub-Signature-256`) verificada com comparação em tempo constante (`crypto.timingSafeEqual`) para prevenir ataques de timing
- O corpo bruto da requisição é preservado antes do `express.json()` parse para garantir a integridade da assinatura
- O token de verificação do webhook (`WA_WEBHOOK_VERIFY_TOKEN`) deve ser diferente de todos os outros tokens do sistema

### Checklist de segurança para produção

- [ ] `NODE_ENV=production` — desativa stack traces nas respostas de erro
- [ ] HTTPS em todos os endpoints (Nginx + Let's Encrypt recomendados)
- [ ] `CORS_ORIGINS` restringe apenas ao domínio real do dashboard
- [ ] Rate limit ajustado para seu volume real de requisições
- [ ] Rotação periódica do `apiToken` dos agentes (mensal)
- [ ] Backup automatizado do banco PostgreSQL
- [ ] Monitoramento de erros (ex.: Sentry) integrado ao `errorHandler`
- [ ] Revisão das políticas de uso da WhatsApp Business Platform antes de escalar envios

---

## Conformidade LGPD / WhatsApp

Este sistema foi projetado para operar dentro das políticas da Meta e da LGPD brasileira:

1. **Consentimento explícito**: todo contato precisa ter `optInStatus = CONFIRMED` com registro de origem, timestamp e IP antes de receber mensagens
2. **Direito ao esquecimento**: implementado via anonimização (`DELETE /api/contacts/:id`)
3. **Minimização de dados**: apenas nome, telefone e e-mail (criptografado) são armazenados
4. **Portabilidade**: os dados podem ser exportados via Prisma Studio ou consulta direta ao banco
5. **Segurança**: criptografia em repouso para PII, HTTPS em trânsito, controle de acesso por papel (USER/ADMIN)
6. **Templates aprovados**: mensagens em escala usam apenas templates pré-aprovados pela Meta
7. **Opt-out imediato**: qualquer mensagem com palavra-chave de cancelamento é processada em tempo real pelo webhook

> **Aviso**: este software é fornecido como ponto de partida. A adequação plena à LGPD e às políticas da Meta é responsabilidade de quem o opera. Consulte um especialista jurídico antes de lançar em produção.

---

## Licença

Uso interno. Todos os direitos reservados.


---

> **Status:** Vercel deployment em progresso. Atualizado em 09/03/2025.
