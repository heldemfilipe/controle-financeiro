<div align="center">

<img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />

<br /><br />

# 💰 Controle Financeiro

**App de controle financeiro pessoal e familiar.**
Gerencie receitas, contas fixas e cartões de crédito com gráficos interativos, dark mode e acesso autenticado.

<br />

[**Reportar Bug**](../../issues) · [**Sugerir Feature**](../../issues)

</div>

---

## ✨ Funcionalidades

<table>
<tr>
<td width="50%">

### 📊 Visualizações
- **Dashboard** — receitas vs despesas (12 meses), saldo acumulado e distribuição por categoria
- **Gastos Anuais** — KPIs anuais, gráfico de área, perfil de gastos (radar), taxa de poupança
- **Análise por Categoria** — pizza interativa com detalhamento e barras anuais empilhadas
- **Gastos por Cartão** — comparativo entre cartões, top compras e estabelecimentos

</td>
<td width="50%">

### 📅 Controle Mensal
- **Gastos do Mês** — toggle pago/não pago com alerta de vencimento próximo
- **Faturas** — transações detalhadas por cartão com histórico anual
- **Lançamentos** — CRUD completo de receitas, contas fixas e transações de cartão
- **Saldo Acumulado** — carry-over configurável com saldo inicial personalizado

</td>
</tr>
<tr>
<td width="50%">

### ⚙️ Configurações
- **Fontes de Renda** — múltiplos owners (`pessoa1`, `pessoa2`, `casal`)
- **Cartões de Crédito** — preview visual com cor customizável
- **Contas Fixas** — parcelamento inteligente com cálculo dinâmico por mês
- **Dízimo Automático** — calculado como 10% da renda do mês

</td>
<td width="50%">

### 🔐 Autenticação & Admin
- **Login com e-mail/senha** via Supabase Auth
- **Gerenciamento de usuários** — criar, editar, desativar e redefinir senhas
- **Roles** — Admin e Usuário Comum
- **Responsivo** — layout adaptado para celular e desktop

</td>
</tr>
</table>

---

## 🛠 Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| [Next.js](https://nextjs.org) | 14 (App Router) | Framework React com SSR e API Routes |
| [TypeScript](https://www.typescriptlang.org) | 5.x | Tipagem estática em todo o projeto |
| [Tailwind CSS](https://tailwindcss.com) | 3.4 | Estilização responsiva com dark mode |
| [Supabase](https://supabase.com) | — | Banco PostgreSQL + Auth + RLS |
| [Recharts](https://recharts.org) | 2.x | Bar, Line, Pie, Radar, Area charts |
| [Lucide React](https://lucide.dev) | — | Ícones |
| [@supabase/ssr](https://supabase.com/docs/guides/auth/server-side/nextjs) | — | Auth com cookies e middleware |
| [Vercel](https://vercel.com) | — | Deploy e CI/CD |

---

## 🚀 Início Rápido

### 1. Clone e instale

```bash
git clone https://github.com/seu-usuario/controle-financeiro.git
cd controle-financeiro
npm install
```

### 2. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, execute os arquivos na ordem:

```
supabase/schema.sql   ← cria tabelas, índices e políticas RLS
supabase/seed.sql     ← dados de exemplo (opcional)
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

| Variável | Onde encontrar | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon/public | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role | ✅ (admin) |
| `NEXT_PUBLIC_APP_NAME` | Qualquer texto (ex: `João & Maria`) | ⬜ |
| `NEXT_PUBLIC_APP_YEAR` | Ano exibido na sidebar (ex: `2026`) | ⬜ |

> ⚠️ **Nunca** prefixe `SUPABASE_SERVICE_ROLE_KEY` com `NEXT_PUBLIC_` — ela deve ficar **apenas no servidor**.

### 4. Rode localmente

```bash
npm run dev
# Acesse http://localhost:3000
```

---

## 🔐 Configurar o primeiro Admin

**1.** Crie o usuário em **Authentication → Users → Add user**

**2.** Execute no **SQL Editor** para promovê-lo a admin:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'seu@email.com';
```

**3.** Faça login → a aba **Usuários** aparece em Configurações

A partir daí, novos usuários são criados e gerenciados diretamente pelo app (sem precisar acessar o Supabase).

---

## 🗄 Banco de Dados

### Tabelas

| Tabela | Descrição |
|---|---|
| `income_sources` | Fontes de renda com suporte a múltiplos owners e renda recorrente/extra |
| `fixed_bills` | Contas fixas com parcelamento dinâmico e flag de dízimo |
| `credit_cards` | Cartões com cor, banco e dia de vencimento |
| `card_transactions` | Lançamentos por cartão/mês |
| `monthly_bill_payments` | Status pago/pendente das contas por mês (sobrescreve valor base) |
| `monthly_card_payments` | Status pago/pendente das faturas por mês |
| `monthly_incomes` | Recebimentos mensais por fonte (sobrescreve valor base) |

### Recursos especiais

| Conceito | Como funciona |
|---|---|
| **Dízimo** | `is_tithe = true` + `amount = 0` no banco — o app calcula 10% da renda dinamicamente |
| **Parcelas** | `installment_start_month/year` definem o início; o app calcula qual parcela exibir e oculta fora do período |
| **Owner** | Campo texto livre — use `"joao"`, `"maria"`, `"casal"` ou qualquer identificador |
| **RLS** | Habilitado em todas as tabelas com `allow_all` via anon key (adequado para app pessoal/privado) |

---

## 📁 Estrutura do Projeto

```
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── gastos-anuais/              # Visão anual
│   ├── gastos-mensais/             # Controle mensal
│   ├── lancamentos/                # CRUD receitas, contas e cartões
│   ├── faturas/                    # Faturas por cartão
│   ├── analise/                    # Análise por categoria
│   ├── gastos-cartoes/             # Comparativo entre cartões
│   ├── configuracoes/              # Configurações + Gerenciamento de usuários
│   ├── login/                      # Tela de login
│   └── api/admin/users/            # API routes para operações de admin
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Sidebar com logout e email do usuário
│   │   └── LayoutShell.tsx         # Layout responsivo com menu hamburger mobile
│   └── ui/                         # Modal, Toggle, MonthSelector, ChartTooltip…
├── lib/
│   ├── supabase.ts                 # Cliente Supabase para queries
│   ├── supabase-browser.ts         # Cliente browser para auth
│   ├── supabase-admin.ts           # Cliente server-side com service role
│   ├── queries.ts                  # Todas as queries do banco
│   └── utils.ts                    # Helpers: formatCurrency, computeInstallment, sumTransactions…
├── middleware.ts                    # Protege rotas, redireciona para /login
├── types/index.ts                   # Tipos TypeScript globais
└── supabase/
    ├── schema.sql                   # Schema completo com RLS
    └── seed.sql                     # Dados genéricos de exemplo
```

---

## 🚢 Deploy na Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Importe o repositório na [Vercel](https://vercel.com)
2. Configure as variáveis de ambiente em **Settings → Environment Variables**
3. Deploy automático a cada push em `main`

---

## ⚙️ Personalização

### Owners (membros da família)

O `owner` é texto livre — altere direto nos cadastros pelo app:

```
"joao"    "maria"    "casal"    "empresa"    "pessoa1"    ...
```

### Cores dos cartões

Configure via **Configurações → Cartões** com color picker e paleta rápida de 7 cores.

### Saldo Acumulado

Em **Gastos do Mês → ícone ⚙️**, configure:
- **Saldo Inicial** — poupança ou valor já existente antes de usar o app
- **Início do Acumulado** — mês/ano de onde começa a somar o carry-over

---

## 📝 Licença

[MIT](LICENSE) — use, modifique e distribua livremente.

---

<div align="center">
Feito com Next.js + Supabase
</div>
