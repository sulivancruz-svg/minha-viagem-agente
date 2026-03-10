# 🔌 Fase 2: Conectar Extensão Chrome ao Backend em Railway

## Status: PASSO-A-PASSO PARA USUÁRIO

---

## 📱 Como a Extensão Funciona

A extensão Chrome precisa saber:
1. **URL do Backend**: onde buscar dados (campanhas, hotéis, contatos)
2. **Token JWT**: para autenticar nas requisições

Antes: URL padrão era `http://127.0.0.1:3001` (localhost)
**Agora**: Backend está em Railway em `https://minha-viagem-production-backend.up.railway.app`

---

## 🚀 PASSO 1: Instalar a Extensão Chrome

A extensão já está compilada em: `packages/extension/dist/`

### Como instalar (modo desenvolvimento):

1. **Abra Chrome/Chromium**
2. Vá para: `chrome://extensions/`
3. Ative **"Modo de Desenvolvedor"** (canto superior direito)
4. Clique em **"Carregar extensão sem empacotar"**
5. Selecione a pasta: `C:\Users\suliv\OneDrive\Área de Trabalho\dash\minha-viagem-agente\packages\extension\dist`
6. A extensão aparecerá com ícone "MV" (Minha Viagem)

---

## 🔑 PASSO 2: Configurar URL do Backend

1. **Clique no ícone da extensão** (MV) no Chrome
2. **Popup abre** com formulário
3. **Campo "URL do servidor"** mostra: `http://127.0.0.1:3001`
4. **Limpe e digite**:
   ```
   https://minha-viagem-production-backend.up.railway.app
   ```
5. **Deixe o campo salvo** (não precisa clicar em nada ainda)

---

## 🔐 PASSO 3: Fazer Login

Você tem duas opções:

### Opção A: Login com Email/Senha (Recomendado)

1. No popup da extensão, preencha:
   - **Email**: (use o mesmo do Dashboard)
   - **Senha**: (use a mesma da Dashboard)

2. Clique no botão **"Entrar com email/senha"**

3. A extensão:
   - Enviará email/senha para `https://minha-viagem-production-backend.up.railway.app/api/auth/login`
   - Receberá um token JWT
   - Salvará o token automaticamente

4. **Resultado esperado**:
   - Status muda para 🟢 **"Conectado"**
   - Botão fica verde

### Opção B: Usar Token Manual (Debug)

Se tiver um JWT token pronto:
1. Cole no campo **"Token de acesso (debug)"**
2. Clique **"Salvar e conectar"**

---

## ✅ PASSO 4: Verificar Conexão

Quando a extensão está **conectada** (status 🟢):

A extensão agora consegue:
- ✅ Buscar campanhas do Backend
- ✅ Buscar hotéis do catálogo
- ✅ Buscar contatos/leads
- ✅ Criar tarefas
- ✅ Registrar envios assistidos
- ✅ Buscar métricas

---

## 🧪 Teste de Integração

Para verificar que a extensão está realmente conectada:

1. **Abra o Dashboard**: https://minha-viagem-agente-dashboard.vercel.app
2. **Login**: use as mesmas credenciais
3. **Vá a**: Admin → Campanhas
4. **Crie uma campanha teste** (ex: "Teste Integração")
5. **Na extensão**, abra o popup novamente
6. A campanha deve aparecer disponível

---

## 🚨 Troubleshooting

### ❌ Erro: "Nao autenticado: verifique URL da API e token"

**Possíveis causas:**
1. **URL inválida**
   - Verifique: `https://minha-viagem-production-backend.up.railway.app`
   - Sem trailing slash `/`

2. **Backend offline**
   - Verifique no Railway se está "Online"
   - Vá para: https://railway.app/project/76685e2f-dfce-4e1f-a09e-27a65677d9a7

3. **Credenciais incorretas**
   - Verifique email/senha no Dashboard
   - Dashboard login funciona? Se sim, use as mesmas credenciais

4. **Timeout**
   - A requisição demorou mais de 12 segundos
   - Verifique conexão com internet
   - Tente novamente

---

### ❌ Erro: "API timeout (12000ms)"

**Significa:** Backend não respondeu em 12 segundos

**Soluções:**
1. Verifique se Backend está ONLINE em Railway
2. Aguarde alguns minutos
3. Tente novamente

---

### ❌ Extensão não carrega / Erro ao instalar

**Solução:**
1. Verifique se a pasta `dist/` existe:
   ```bash
   ls packages/extension/dist/
   ```
2. Se vazia, compile:
   ```bash
   cd packages/extension
   npm run build
   ```
3. Recarregue em `chrome://extensions/`

---

## 📊 Arquitectura Completa

```
┌─────────────────────────────────────────────────────┐
│ Agente abre extensão Chrome                          │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ Popup de Login (React)  │
        │ - URL: [input]          │
        │ - Email: [input]        │
        │ - Senha: [input]        │
        └────────────┬────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ Background Script (Service Worker MV3)    │
        │ - Recebe mensagem 'LOGIN'                 │
        │ - POST /api/auth/login → Bearer token    │
        │ - Salva token em Storage                  │
        │ - Invalida caches                         │
        └────────────┬──────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ Backend API (Railway Production)          │
        │ https://minha-viagem-production-ba...     │
        │ - /api/auth/login                        │
        │ - /api/campaigns                         │
        │ - /api/hotels                            │
        │ - /api/contacts                          │
        │ - /api/tasks                             │
        │ - /api/events                            │
        │ - /api/metrics/...                       │
        └────────────┬──────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │ PostgreSQL Supabase (via Railway)         │
        │ - Campanhas, Hotéis, Contatos, Tarefas   │
        └───────────────────────────────────────────┘
```

---

## ✅ Checklist de Conclusão (Fase 2)

- [ ] URL do Backend configurada na extensão
- [ ] Login feito com sucesso (status 🟢 Conectado)
- [ ] Token JWT salvo no storage da extensão
- [ ] Campanha criada no Dashboard
- [ ] Campanha aparece no popup da extensão
- [ ] Extensão consegue buscar hotéis
- [ ] Extensão consegue buscar contatos

---

## 📝 Próximos Passos (Fase 3)

Quando Fase 2 estiver completa:

1. **Multi-tenant**: Cada agência tem dados isolados
2. **Validation de subscription**: Verificar se agência pagou
3. **Publicação na Chrome Web Store**

---

**Versão**: 1.0.0
**Data**: 10 de Março, 2026
**Status**: Fase 2 ativa 🚀

