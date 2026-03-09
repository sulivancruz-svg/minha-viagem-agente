# 🚀 Guia: Deploy no Vercel + Domínio Vendamaisviagens.com.br

## Fase 4.1: Deploy do Dashboard no Vercel

### Passo 1: Conectar Repositório GitHub ao Vercel

1. Acesse https://vercel.com/dashboard
2. Clique em **"New Project"** ou **"Add New"** → **"Project"**
3. Clique em **"Continue with GitHub"** (você já conectou antes)
4. Procure por **"minha-viagem-agente"** na lista de repositórios
5. Clique em **"Import"**

### Passo 2: Configurar Projeto Vercel

Na tela **"Configure Project"**:

1. **Project Name:** `minha-viagem-agente` (ou `vendamaisviagens` se preferir)
2. **Framework Preset:** Vercel detectará como **Next.js** automaticamente
3. **Root Directory:** Mude para `packages/dashboard` (IMPORTANTE!)
   - Se não mudar, o build falhará
4. **Environment Variables:** Clique em "Add Environment Variable"

### Passo 3: Adicionar Variáveis de Ambiente

Adicione as seguintes variáveis (deixe vazio ou com valor padrão por enquanto):

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `DATABASE_URL` | (preencher depois) | Supabase connection string |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` (dev) ou URL do backend (prod) | URL da API |
| `JWT_SECRET` | `dev-secret-change-in-prod` | Será sincronizado do backend |
| `NEXT_PUBLIC_AUTH_SECRET` | (gerar com openssl rand -base64 32) | Para autenticação no Next.js |

**Exemplo para produção:**
- `NEXT_PUBLIC_API_URL` = `https://api.vendamaisviagens.com.br` (será configurado depois)

### Passo 4: Deploy

1. Clique em **"Deploy"**
2. Vercel começará a fazer build (pode levar 2-3 minutos)
3. Se bem-sucedido, você verá uma tela azul com **"Congratulations!"**
4. Clique em **"Visit"** para acessar a aplicação

---

## Fase 4.2: Deploy do Backend (Express API)

### ⚠️ Importante: Backend requer deploy separado

O backend Express **não é compatível com Vercel** (Vercel é otimizado para Next.js). Você tem estas opções:

#### **Opção 1: Railway (RECOMENDADO - Fácil, 5 minutos)**

Railway suporta Node.js/Express nativamente e oferece PostgreSQL grátis.

1. Acesse https://railway.app
2. Clique em **"Start a New Project"**
3. Selecione **"Deploy from GitHub"**
4. Conecte com GitHub (mesma conta que Vercel)
5. Selecione repositório **"minha-viagem-agente"**
6. Adicione serviço **"PostgreSQL"** (banco de dados)
7. Configure variáveis de ambiente:
   - `DATABASE_URL`: Será auto-gerada pelo Railway para PostgreSQL
   - `JWT_SECRET`: `sua-chave-aleatoria-aqui`
   - `CORS_ORIGINS`: `https://vendamaisviagens.com.br,https://www.vendamaisviagens.com.br`
   - `NODE_ENV`: `production`
   - `PORT`: `3001`

8. Railway gerará URL de deploy: `https://seu-projeto-railway.up.railway.app`
9. Use essa URL como `NEXT_PUBLIC_API_URL` no Vercel

#### **Opção 2: Render.com (Alternativa)**

Similar ao Railway, com plano free com 2 horas/dia ativo.

#### **Opção 3: Supabase Functions (Avançado)**

Se quiser usar Supabase Functions, seria uma refatoração maior do backend.

---

## Fase 4.3: Configurar Domínio Vendamaisviagens.com.br

### Para o Dashboard (Vercel)

1. Acesse seu projeto no Vercel Dashboard
2. Vá em **Settings** → **Domains**
3. Clique em **"Add"**
4. Insira `vendamaisviagens.com.br`
5. Vercel exibirá registros DNS a configurar:

```
Type    Name                      Value
CNAME   vendamaisviagens.com.br   cname.vercel-dns.com.
```

6. Acesse seu registro de domínio (onde você comprou)
7. Vá em **DNS Settings**
8. Adicione o registro CNAME conforme mostrado
9. Aguarde 5-30 minutos para propagar
10. Volte ao Vercel e clique em "Verify DNS Configuration"

### Para o Backend (se usando Railway)

1. Se usando Railway, configure um subdomínio:
   - `api.vendamaisviagens.com.br`
   - Use um CNAME para o Railway URL

2. Ou use diretamente a URL do Railway sem domínio customizado

### Certificado SSL/HTTPS

Vercel fornece certificado Let's Encrypt automaticamente — sem passos adicionais.

---

## Fase 4.4: Variáveis Finais (Prod)

Após tudo estar funcionando, volte ao Vercel e atualize as variáveis:

1. Vá em **Settings** → **Environment Variables**
2. Atualize `NEXT_PUBLIC_API_URL`:
   ```
   https://api.vendamaisviagens.com.br  (ou URL do Railway)
   ```
3. Clique em **"Redeploy"** para aplicar mudanças

---

## Checklist Final

- [ ] Repositório GitHub criado e código enviado
- [ ] vercel.json adicionado e commitado
- [ ] Dashboard deployado no Vercel
- [ ] Backend deployado (Railway/Render/outro)
- [ ] Variáveis de ambiente configuradas em ambos
- [ ] Domínio vendamaisviagens.com.br apontando para Vercel
- [ ] Domínio API (api.vendamaisviagens.com.br) apontando para backend
- [ ] Teste de conexão: Dashboard → Backend API funciona
- [ ] HTTPS ativo em ambos os domínios

---

## Troubleshooting

### Erro: "Cannot find module 'prisma'" no Vercel

**Solução:** Adicione script no Vercel:
1. Settings → Build & Development Settings
2. Build Command: `pnpm install && pnpm db:generate && pnpm build:all`
3. Output Directory: `packages/dashboard/.next`

### Erro: "CORS error" no Dashboard

**Solução:** Atualize `CORS_ORIGINS` no backend:
```
CORS_ORIGINS=https://vendamaisviagens.com.br,https://www.vendamaisviagens.com.br
```

### Erro: "DATABASE_URL não definida"

**Solução:** Adicione a variável no Vercel Environment Variables com a string do Supabase.

---

## Próximos Passos

1. ✅ GitHub: Repositório criado
2. ⏳ Vercel: Siga os passos acima
3. ⏳ Railway: Siga os passos acima (ou outra opção para backend)
4. ⏳ DNS: Configure o domínio
5. ⏳ Testes: Valide funcionamento de ponta a ponta

Após completar, você terá:
- 🌐 `https://vendamaisviagens.com.br` (Dashboard + aplicação web)
- 🔌 `https://api.vendamaisviagens.com.br` (Backend API)
- 🔐 SSL/HTTPS em ambos
- 📊 Admin dashboard funcional
- 💬 Integração WhatsApp Web funcionando
