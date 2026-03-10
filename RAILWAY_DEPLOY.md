# 🚀 Guia de Deploy: Backend no Railway

**Tempo estimado:** 10-15 minutos
**Serviço:** Railway.app (hospedagem Node.js + PostgreSQL)
**Custos:** Gratuito para começar (até $5/mês)

---

## ✅ Pré-requisitos

- [x] Conta no Railway (https://railway.app) — grátis com GitHub
- [x] GitHub conectado à sua conta Railway
- [x] Backend estruturado (JÁ PRONTO)
- [x] Database URL do Supabase (JÁ CONFIGURADO)

---

## 📋 Passo 1: Criar Projeto no Railway

### 1.1 Acesse Railway.app

```
https://railway.app
```

### 1.2 Login com GitHub

1. Clique em **"Start a New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Autorize Railway a acessar seu GitHub
4. Selecione o repositório: **sulivancruz-svg/minha-viagem-agente**

### 1.3 Configurar Projeto

```
Project Name: minha-viagem-agente
Environment: production
Branch: main
```

---

## 📦 Passo 2: Adicionar Serviço PostgreSQL (opcional)

> **NOTA:** Se você já está usando Supabase (que você está), pule para o Passo 3.
> O Railway detectará automaticamente o Node.js e criará um serviço.

### Se quiser PostgreSQL no Railway (em vez de Supabase):

1. No Railway Dashboard → "+ Add Service"
2. Selecione **"Database"** → **"PostgreSQL"**
3. Railway gera automaticamente: `DATABASE_URL`

---

## 🔧 Passo 3: Configurar Variáveis de Ambiente

Após o projeto ser criado, acesse **"Variables"** e adicione:

### Variáveis Obrigatórias:

```
DATABASE_URL=postgresql://postgres:Bela12@db.jrnuooaqxbmtxbdwrqww.supabase.co:5432/postgres

JWT_SECRET=<gere-uma-chave-segura>
(Exemplo: openssl rand -base64 32)

NODE_ENV=production

PORT=3001

CORS_ORIGINS=https://minha-viagem-agente-dashboard.vercel.app,https://vendamaisviagens.com.br,https://www.vendamaisviagens.com.br,chrome-extension://*

ENCRYPTION_KEY=<gere-uma-chave-32-bytes-hex>
(Exemplo: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

DASHBOARD_URL=https://minha-viagem-agente-dashboard.vercel.app

LOG_LEVEL=info
```

### Variáveis Opcionais:

```
# Se implementar envio de emails (opcional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=seu_email@gmail.com
# SMTP_PASS=seu_app_password
# SMTP_FROM=noreply@vendamaisviagens.com.br
```

---

## 🏗️ Passo 4: Configurar Build & Deploy

Railway auto-detecta Node.js. Você pode (opcionalmente) customizar em **"Settings"**:

### Build Command (RECOMENDADO):
```bash
pnpm install
pnpm run db:generate
pnpm run build
```

### Start Command (RECOMENDADO):
```bash
cd packages/backend && npm start
```

Ou deixe Railway usar o padrão: `npm start`

---

## 🚀 Passo 5: Fazer Deploy

### Opção A: Deploy Automático (Recomendado)

1. Railway detecta mudanças no `main` automaticamente
2. Cada push no GitHub dispara novo deploy
3. Status aparece em **"Deployments"**

### Opção B: Deploy Manual

1. No Railway Dashboard → **"Trigger Deploy"**
2. Aguarde 2-3 minutos
3. Verifique logs: **"View Logs"** → "Build Logs"

---

## ✅ Passo 6: Validar Deploy

### 6.1 Verificar Status

Railway Dashboard → **"Deployment Status"** deve estar verde (✅ Success)

### 6.2 Obter URL da API

Na aba **"Deployment"**, você verá:
```
https://[seu-projeto-id].up.railway.app
```

### 6.3 Testar Endpoints

Abra seu navegador ou Postman e teste:

```
GET https://[seu-projeto-id].up.railway.app/health
```

Resposta esperada:
```json
{ "status": "ok", "timestamp": "2026-03-09T..." }
```

Se retornar 200 OK: ✅ **Backend está rodando!**

---

## 🔗 Passo 7: Conectar Dashboard ao Backend

Agora que o backend está no Railway, atualize o dashboard para apontar para a API:

### 7.1 No Vercel Dashboard

1. Acesse: https://vercel.com/sulivancruz-svgs-projects/minha-viagem-agente-dashboard
2. Vá em **"Settings"** → **"Environment Variables"**
3. Atualize ou crie:
   ```
   NEXT_PUBLIC_API_URL=https://[seu-projeto-id].up.railway.app
   ```
4. Clique **"Save"** → **"Redeploy"**

### 7.2 Aguarde Novo Deploy

Vercel automaticamente refará o build com a nova variável.
Tempo: 1-2 minutos.

### 7.3 Teste Conexão

Acesse o dashboard: https://minha-viagem-agente-dashboard.vercel.app

Abra o Console do navegador (F12) e procure por erros CORS.
Se não houver erros de rede: ✅ **Conexão estabelecida!**

---

## 📊 Estrutura Final Após Deploy

```
┌─────────────────────────────────────────────┐
│  Seu Navegador                              │
│  https://minha-viagem-agente-dashboard.vercel.app
└────────────────┬────────────────────────────┘
                 │ (HTTPS)
                 ▼
     ┌───────────────────────────┐
     │  Dashboard (Vercel)       │
     │  Next.js + React          │
     │  Rodando em produção ✅  │
     └───────────┬───────────────┘
                 │ NEXT_PUBLIC_API_URL
                 │ (HTTPS)
                 ▼
     ┌───────────────────────────┐
     │  Backend (Railway)        │
     │  Express + Node.js        │
     │  Rodando em produção ✅  │
     │  [seu-projeto-id].up.railway.app
     └───────────┬───────────────┘
                 │
                 ▼
     ┌───────────────────────────┐
     │  Database (Supabase)      │
     │  PostgreSQL               │
     │  Conectado ✅            │
     └───────────────────────────┘
```

---

## 🔐 Segurança Importante

- ✅ **JWT_SECRET**: Gere uma chave segura com `openssl rand -base64 32`
- ✅ **ENCRYPTION_KEY**: Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- ✅ **CORS_ORIGINS**: Sempre especifique seus domínios reais
- ✅ **NODE_ENV**: Sempre `production` em servidor
- ✅ **DATABASE_URL**: Nunca exponha publicamente (Railway a mantém secreto)

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Build fails com "module not found" | Execute `pnpm install` localmente, depois `git push` |
| "Cannot connect to database" | Verifique DATABASE_URL está correta em Variables |
| CORS error no dashboard | Atualize CORS_ORIGINS com seu domínio no Railway |
| Timeout ao fazer deploy | Railway pode estar ocupado. Tente novamente em 1 minuto |
| Health check falha | Verifique se PORT está definido como 3001 |

---

## 📋 Checklist Final

- [ ] Projeto criado no Railway
- [ ] Variáveis de ambiente configuradas
- [ ] Build com sucesso (ver logs)
- [ ] Deploy com sucesso (status verde)
- [ ] Health check respondendo
- [ ] Dashboard atualizado com NEXT_PUBLIC_API_URL
- [ ] Vercel refez build
- [ ] Teste de conexão OK (sem CORS errors)
- [ ] Domínio customizado configurado (próximo passo)

---

## 🎯 Próximo Passo

Após validar que dashboard e backend estão se comunicando:

→ **Fase 5: Configurar Domínio Customizado** `vendamaisviagens.com.br`

Veja: `DEPLOYMENT_STATUS.md` - PASSO 4

---

## 📞 Precisa de ajuda?

1. **Verificar logs do Railway:**
   - Dashboard → Deployments → View Logs

2. **Verificar logs do Vercel:**
   - https://vercel.com → Seu projeto → Deployments → Logs

3. **Testar API localmente:**
   ```bash
   cd packages/backend
   npm run dev
   # Testa em http://localhost:3001
   ```

---

**Tempo total para esta fase:** 10-15 minutos ⏱️
