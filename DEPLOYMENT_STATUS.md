# 📋 Status: Preparação para Deploy em Produção

**Data:** 09 de Março de 2025
**Projeto:** minha-viagem-agente (CRM de Viagens + WhatsApp Web)
**Status:** ✅ 75% Completo - Pronto para Vercel
 | Git Webhook Reconectado
---

## ✅ Completado (Fase 1-3)

### Phase 1: Security Audit
- ✅ Nenhuma secret exposta em código-fonte (API keys, senhas, tokens)
- ✅ Arquivo `.env.example` criado com valores seguros para desenvolvimento
- ✅ Banco de dados: SQLite (dev) e PostgreSQL/Supabase (prod) configurados
- ✅ JWT Secret gerado com instruções de produção
- ✅ Encryption key (AES-256) configurada

### Phase 2: Code Quality
- ✅ Removidos 44 console.log de backend e extension
- ✅ Código limpo e pronto para produção
- ✅ TypeScript configurado (sem erros de compilação)
- ✅ ESLint e Prettier padronizados

### Phase 3: Configuration
- ✅ `packages/backend/.env.example` com todas as variáveis de ambiente
- ✅ CORS configurado para desenvolvimento local
- ✅ Endpoints de teste validados
- ✅ Database migrations preparadas

### Phase 4.1: Git & Deployment
- ✅ Repositório Git inicializado localmente
- ✅ 260 arquivos commitados com mensagens descritivas
- ✅ Repositório GitHub criado: https://github.com/sulivancruz-svg/minha-viagem-agente
- ✅ Código enviado ao GitHub (git push origin main)
- ✅ `vercel.json` adicionado com configuração de monorepo
- ✅ `VERCEL_DEPLOY.md` criado com guia passo a passo

---

## ⏳ Próximos Passos (Fase 4.2 - 5)

### PASSO 1: Deploy Dashboard no Vercel (5-10 minutos)

```
1. Acesse https://vercel.com/dashboard
2. Clique em "New Project"
3. Importe repositório: sulivancruz-svg/minha-viagem-agente
4. Defina Root Directory: packages/dashboard
5. Clique em "Deploy"
6. Aguarde conclusão (2-3 minutos)
7. Você terá um URL: https://[seu-projeto].vercel.app
```

✅ **Resultado esperado:** Dashboard acessível em https://[seu-projeto].vercel.app

---

### PASSO 2: Deploy Backend API (10-15 minutos)

O Backend Express requer um serviço diferente (Vercel é para Next.js).

#### Opção RECOMENDADA: Railway
```
1. Acesse https://railway.app
2. Clique em "Start a New Project"
3. Selecione "Deploy from GitHub"
4. Importe o mesmo repositório
5. Adicione serviço "PostgreSQL"
6. Configure Environment Variables:
   - DATABASE_URL (auto-gerado)
   - JWT_SECRET
   - CORS_ORIGINS
   - NODE_ENV=production
7. Railway gera URL: https://[seu-projeto].up.railway.app
```

✅ **Resultado esperado:** API rodando em https://[seu-projeto].up.railway.app

---

### PASSO 3: Conectar Dashboard ao Backend (2 minutos)

No Vercel Dashboard:
```
1. Vá em Settings → Environment Variables
2. Adicione: NEXT_PUBLIC_API_URL = https://[seu-projeto].up.railway.app
3. Clique em "Redeploy"
4. Aguarde novo build
```

✅ **Teste:** Dashboard conecta à API do Railway

---

### PASSO 4: Configurar Domínio Vendamaisviagens.com.br (10-20 minutos)

#### 4a. Domínio Principal (Vercel)
```
1. No Vercel: Settings → Domains
2. Clique "Add"
3. Digite: vendamaisviagens.com.br
4. Copie o CNAME record exibido
5. Acesse seu registrador de domínio (GoDaddy, Namecheap, etc.)
6. Vá em DNS Settings
7. Adicione o CNAME conforme Vercel indicou
8. Aguarde propagação (5-30 minutos)
9. Vercel valida automaticamente
```

#### 4b. Domínio API (opcional, apenas se quiser)
```
1. Similar ao acima, mas para subdomain: api.vendamaisviagens.com.br
2. Aponte para URL do Railway
```

✅ **Teste:** Acesse https://vendamaisviagens.com.br no navegador

---

### PASSO 5: Configuração Final de Variáveis (5 minutos)

**Backend (Railway):**
```
DATABASE_URL = postgresql://postgres:password@host/db (auto-gerado)
JWT_SECRET = gere-uma-chave-segura
CORS_ORIGINS = https://vendamaisviagens.com.br,https://www.vendamaisviagens.com.br
NODE_ENV = production
PORT = 3001 (padrão)
```

**Dashboard (Vercel):**
```
DATABASE_URL = mesma do backend
NEXT_PUBLIC_API_URL = https://api.vendamaisviagens.com.br (ou URL railway)
NEXT_PUBLIC_AUTH_SECRET = openssl rand -base64 32 (gere novamente)
```

---

## 📊 Estrutura Final Esperada

```
┌─────────────────────────────────────────────┐
│  Navegador: https://vendamaisviagens.com.br │
└────────────────┬────────────────────────────┘
                 │ (HTTPS)
                 ▼
     ┌───────────────────────────┐
     │  Dashboard (Vercel)       │
     │  - Next.js Frontend       │
     │  - React Admin UI         │
     │  - Tailwind CSS           │
     └───────────┬───────────────┘
                 │ NEXT_PUBLIC_API_URL
                 │ (HTTPS)
                 ▼
     ┌───────────────────────────┐
     │  Backend API (Railway)    │
     │  - Express.js             │
     │  - Prisma ORM             │
     │  - PostgreSQL             │
     │  - WhatsApp Web.js        │
     └───────────────────────────┘
                 │
                 ▼
     ┌───────────────────────────┐
     │  Database (Supabase)      │
     │  - PostgreSQL             │
     └───────────────────────────┘
```

---

## 🔐 Variáveis de Ambiente - Resumo Necessário

### Backend (Railway)
```
DATABASE_URL="postgresql://user:pass@host:5432/db"  # Do Supabase
JWT_SECRET="chave-longa-aleatoria-32-chars-minimo"
JWT_EXPIRES_IN="7d"
NODE_ENV="production"
PORT="3001"
CORS_ORIGINS="https://vendamaisviagens.com.br,https://www.vendamaisviagens.com.br"
ENCRYPTION_KEY="32-bytes-em-formato-hex"
DASHBOARD_URL="https://vendamaisviagens.com.br"
LOG_LEVEL="info"
```

### Dashboard (Vercel)
```
DATABASE_URL="postgresql://..."  # Mesmo do backend
NEXT_PUBLIC_API_URL="https://api.vendamaisviagens.com.br"
NEXT_PUBLIC_AUTH_SECRET="valor-aleatório-de-32-chars"
```

---

## ✨ Checklist de Conclusão

- [ ] Dashboard deployado no Vercel (https://vercel.com/dashboard)
- [ ] Backend deployado no Railway (https://railway.app)
- [ ] Domínio vendamaisviagens.com.br apontando para Vercel
- [ ] Variáveis de ambiente configuradas em ambos
- [ ] Teste de conexão: Dashboard → Backend funciona (console sem erros)
- [ ] HTTPS/SSL ativo em ambos os domínios
- [ ] Admin dashboard carrega e autentica
- [ ] WhatsApp Web conecta (extension funciona)

---

## 🚨 Troubleshooting Comum

| Problema | Solução |
|----------|---------|
| Vercel: "Cannot find module" | Add build command: `pnpm install && pnpm db:generate && pnpm build:all` |
| CORS error no dashboard | Atualize `CORS_ORIGINS` no Railway com o domínio correto |
| Database não conecta | Verifique `DATABASE_URL` está preenchida nos dois (Vercel e Railway) |
| Domínio não resolve | Aguarde 5-30 min propagação DNS, depois verifique CNAME em seu registrador |
| WhatsApp Extension não funciona | Verifique CORS_ORIGINS e NEXT_PUBLIC_API_URL |

---

## 📞 Suporte

Se tiver dúvidas:
1. Consulte `VERCEL_DEPLOY.md` para instruções detalhadas
2. Verifique logs no Vercel: Deploy → Logs
3. Verifique logs no Railway: Deployments → Logs
4. Teste endpoints da API com `curl` ou Postman

---

## 📈 Próximas Fases Futuras (Não incluídas agora)

Após deployment em produção:
- Fase 6: CI/CD pipeline (GitHub Actions)
- Fase 7: Backups automáticos do banco
- Fase 8: Monitoramento e alertas
- Fase 9: Analytics (Vercel Analytics)
- Fase 10: Implementação de recursos do plano original (Hotel Catalog, Response Queue, etc.)

**Data de conclusão esperada:** Hoje (2025-03-09)
**Tempo investido:** 4-5 horas de auditoria + setup
**Próxima reunião:** Após deploy bem-sucedido validar todos os testes em produção
