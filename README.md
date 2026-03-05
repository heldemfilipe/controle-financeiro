# 💰 Controle Financeiro

Sistema de controle financeiro pessoal para casais e famílias, construído com Next.js 14, Supabase e Tailwind CSS.

> Gerencie receitas, contas fixas, cartões de crédito e acompanhe o saldo acumulado mês a mês — tudo em um único lugar.

---

## ✨ Funcionalidades

- **Dashboard** — visão geral do mês com gráfico anual de receitas vs despesas e linha de saldo acumulado
- **Gastos Mensais** — controle de pagamentos por quinzena (pago/pendente/vencido), alertas de vencimento próximo e carry-over acumulado
- **Lançamentos** — CRUD completo de receitas, contas fixas e transações de cartão com parcelamento dinâmico
- **Faturas** — detalhamento mensal por cartão
- **Gastos Anuais** — KPIs, gráficos de área e tabela comparativa dos 12 meses
- **Análise por Categoria** — distribuição de gastos com gráficos
- **Gastos por Cartão** — comparativo entre cartões, top compras e estabelecimentos
- **Configurações** — CRUD de fontes de renda, cartões e contas fixas com preview visual
- **Saldo Acumulado** — carry-over configurável com saldo inicial personalizado e mês de início
- **Dízimo automático** — calculado como 10% da renda, agrupado dinamicamente por owner
- **Dark / Light mode** — alterna sem flash de tela
- **Parcelas inteligentes** — calcula a parcela correta para cada mês e oculta contas fora do período

---

## 🛠 Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| [Next.js](https://nextjs.org) | 14 (App Router) | Framework React |
| [TypeScript](https://www.typescriptlang.org) | 5.x | Tipagem estática |
| [Tailwind CSS](https://tailwindcss.com) | 3.4 | Estilização |
| [Supabase](https://supabase.com) | — | Banco de dados PostgreSQL + API |
| [Recharts](https://recharts.org) | 2.x | Gráficos interativos |
| [Lucide React](https://lucide.dev) | — | Ícones |
| [Vercel](https://vercel.com) | — | Deploy |

---

## 🚀 Início Rápido

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/controle-financeiro.git
cd controle-financeiro
npm install
```

### 2. Crie o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. No painel, vá em **SQL Editor** e execute os arquivos na ordem:
   - `supabase/schema.sql` — cria todas as tabelas e índices
   - `supabase/seed.sql` — insere dados de exemplo *(personalize antes de executar)*

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais (encontradas em **Supabase → Project Settings → API**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui

# Opcional — personaliza o nome exibido na sidebar
NEXT_PUBLIC_APP_NAME=João & Maria
NEXT_PUBLIC_APP_YEAR=2026
```

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Configuração

### Owners (proprietários dos recursos)

O campo `owner` é texto livre — use qualquer identificador:

```
"joao", "maria", "casal", "pessoa1", "familia" ...
```

Configure os owners diretamente via **Configurações → Fontes de Renda** e **Configurações → Cartões** no próprio app.

### Nome exibido na Sidebar

Defina `NEXT_PUBLIC_APP_NAME` no `.env.local`. Suporta qualquer texto, incluindo `&`:

```env
NEXT_PUBLIC_APP_NAME=João & Maria
```

### Dízimo (10% da renda)

Na aba **Configurações → Contas**, marque uma conta como **Dízimo**. O valor é calculado automaticamente como 10% da renda total do mês, com breakdown por owner. Para não usar, simplesmente não crie essa conta (ou desative).

### Saldo Acumulado (Carry-over)

Em **Gastos do Mês**, clique no ícone ⚙️ no banner de carry-over para configurar:

| Campo | Descrição |
|---|---|
| **Saldo Inicial** | Valor que você já tinha antes de começar a usar o app (ex.: poupança) |
| **Início do Acumulado** | Mês/ano de onde começa a somar — meses anteriores são ignorados |

> **Dica:** Para desconsiderar meses com dados incompletos, defina o "Início do Acumulado" como o primeiro mês confiável.

### Parcelamento de Contas

Ao criar uma conta fixa com parcelas em **Lançamentos → Contas**, informe:
- **Total de parcelas** — quantas no total
- **Parcela atual** — qual é este mês

O sistema calcula automaticamente o mês de início e oculta a conta em meses fora do seu período.

---

## 🗄️ Banco de Dados

### Tabelas

| Tabela | Descrição |
|---|---|
| `income_sources` | Fontes de renda (salário, extra, etc.) |
| `fixed_bills` | Contas fixas (com suporte a parcelamento) |
| `credit_cards` | Cartões de crédito cadastrados |
| `card_transactions` | Lançamentos por cartão e mês |
| `monthly_bill_payments` | Status de pagamento mensal das contas |
| `monthly_card_payments` | Status de pagamento mensal das faturas |
| `monthly_incomes` | Registros de recebimento mensais |

### Row Level Security

Todas as tabelas têm RLS habilitado com acesso total via `anon key` — adequado para uso pessoal/privado. Para multi-usuário com autenticação, substitua as policies por `auth.uid() = user_id`.

---

## 📁 Estrutura do Projeto

```
├── app/
│   ├── page.tsx                 # Dashboard
│   ├── gastos-anuais/           # Visão anual com KPIs e gráficos
│   ├── gastos-mensais/          # Controle mensal por quinzena
│   ├── lancamentos/             # CRUD receitas, contas e cartões
│   ├── faturas/                 # Faturas detalhadas por cartão
│   ├── analise/                 # Análise por categoria
│   ├── gastos-cartoes/          # Análise comparativa por cartão
│   └── configuracoes/           # Configurações gerais
├── components/
│   ├── layout/Sidebar.tsx
│   └── ui/                      # Modal, Toggle, MonthSelector, SummaryCard, etc.
├── lib/
│   ├── supabase.ts              # Cliente Supabase
│   ├── queries.ts               # Queries do banco de dados
│   └── utils.ts                 # Helpers (formatação, datas, parcelas, carry-over)
├── types/index.ts               # Tipos TypeScript globais
└── supabase/
    ├── schema.sql               # Criação das tabelas e índices
    └── seed.sql                 # Dados de exemplo para começar
```

---

## 🚢 Deploy na Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Importe o repositório na [Vercel](https://vercel.com)
2. Adicione as variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Deploy automático a cada push na branch `main`

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork este repositório
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Commit suas mudanças: `git commit -m "feat: descrição da feature"`
4. Push: `git push origin feat/minha-feature`
5. Abra um Pull Request

---

## 📝 Licença

[MIT](LICENSE) — use, modifique e distribua livremente.
