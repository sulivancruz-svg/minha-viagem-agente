# ⚡ Setup Rápido: Comandos Essenciais

## 🔐 Gerar Chaves de Segurança

Abra PowerShell e execute estes comandos para gerar as variáveis de ambiente necessárias:

### 1️⃣ Gerar JWT_SECRET (32 caracteres aleatórios em base64)

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((1..32 | ForEach-Object { [char][byte](Get-Random -Min 33 -Max 127) } | Join-String)))
```

Ou mais simples (se tiver openssl):
```powershell
openssl rand -base64 32
```

**Salve o valor gerado como JWT_SECRET**

---

### 2️⃣ Gerar ENCRYPTION_KEY (32 bytes em formato hexadecimal)

```powershell
$bytes = [byte[]]::new(32)
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
$rng.GetBytes($bytes)
($bytes | ForEach-Object { '{0:x2}' -f $_ }) -join ''
```

Salve o valor gerado como ENCRYPTION_KEY

---

## 📋 Variáveis Necessárias para o Railway

Quando estiver criando o projeto no Railway, use estas variáveis:

```
DATABASE_URL=postgresql://postgres:Bela12@db.jrnuooaqxbmtxbdwrqww.supabase.co:5432/postgres

JWT_SECRET=<valor-gerado-acima>

NODE_ENV=production

PORT=3001

CORS_ORIGINS=https://minha-viagem-agente-dashboard.vercel.app,https://vendamaisviagens.com.br,chrome-extension://*

ENCRYPTION_KEY=<valor-gerado-acima>

DASHBOARD_URL=https://minha-viagem-agente-dashboard.vercel.app

LOG_LEVEL=info
```

---

## 🌐 Passos Resumidos de Deploy

### Railway (10 minutos)
```
1. Acesse https://railway.app
2. Login com GitHub
3. "Deploy from GitHub repo" → sulivancruz-svg/minha-viagem-agente
4. Adicione as variáveis acima
5. Aguarde build (2-3 minutos)
6. Copie URL: https://[id].up.railway.app
```

### Vercel (1 minuto)
```
1. Acesse https://vercel.com/sulivancruz-svgs-projects/minha-viagem-agente-dashboard
2. Settings → Environment Variables
3. Atualize: NEXT_PUBLIC_API_URL=https://[id].up.railway.app
4. Redeploy
```

---

## ✅ Testar Conexão

Abra navegador e tente:

```
GET https://[railway-id].up.railway.app/health
```

Se retornar `200 OK`, o backend está vivo! ✅

---

## 📁 Arquivos de Referência

- **`DEPLOYMENT_STATUS.md`** - Status completo do projeto
- **`RAILWAY_DEPLOY.md`** - Guia detalhado Railway
- **`packages/backend/.env.example`** - Todas as variáveis possíveis
- **`packages/dashboard/.env.local`** - Variáveis do dashboard

---

## 🎯 Checklist de Deploy

- [ ] Dashboard no Vercel: https://minha-viagem-agente-dashboard.vercel.app ✅ (DONE)
- [ ] Backend no Railway: https://[seu-id].up.railway.app (IN PROGRESS)
- [ ] Domínio: vendamaisviagens.com.br (PENDING)

---

**Tempo total: 15-20 minutos para completar tudo**
