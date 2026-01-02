# Controle Financeiro

Sistema completo de controle financeiro pessoal com armazenamento local utilizando SQLite. Gerencie suas rendas, despesas, cartões de crédito, parcelamentos e visualize projeções financeiras de forma simples e eficiente.

## Características

### Funcionalidades Principais

- **Gestão de Rendas**: Cadastre todas as suas fontes de renda mensais
- **Cartões de Crédito**: Gerencie múltiplos cartões com controle de limite, vencimento e fechamento
- **Parcelamentos**:
  - Parcelamentos em cartão de crédito
  - Parcelamentos em dinheiro (empréstimos/financiamentos)
- **Contas Fixas**: Controle de contas recorrentes e únicas
- **Faturas**: Visualização detalhada das faturas mensais de cada cartão
- **Pagamentos**: Registre e acompanhe pagamentos realizados
- **Projeção Financeira**: Visualize projeções de até 12 meses do seu saldo futuro
- **Histórico**: Análise detalhada de períodos passados
- **Gráficos Interativos**: Visualização gráfica da distribuição de gastos
- **Categorias Customizáveis**: Organize suas despesas por categorias personalizadas
- **Modo Escuro**: Interface adaptável para conforto visual

### Recursos Técnicos

- Armazenamento local persistente com SQLite
- Interface responsiva que se adapta a diferentes tamanhos de tela
- Atualização automática de dados a cada 5 segundos
- Exportação de dados para Excel
- Backend Node.js com Express
- Frontend moderno em JavaScript Vanilla
- Design limpo e intuitivo

## Tecnologias Utilizadas

- **Backend**: Node.js + Express
- **Banco de Dados**: SQLite (sql.js)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Gráficos**: Chart.js
- **Exportação**: SheetJS (xlsx)

## Instalação

### Pré-requisitos

- Node.js (versão 14 ou superior)
- npm (gerenciador de pacotes do Node.js)

### Passos de Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/controle-financeiro.git
cd controle-financeiro
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
npm start
```

4. Acesse a aplicação no navegador:
```
http://localhost:3000
```

## Estrutura do Projeto

```
controle-financeiro/
├── server.js           # Servidor Express e rotas da API
├── database.js         # Configuração e operações do SQLite
├── index.html          # Interface principal
├── script.js           # Lógica do frontend
├── styles.css          # Estilos e responsividade
├── package.json        # Dependências do projeto
├── financeiro.db       # Banco de dados SQLite (gerado automaticamente)
└── README.md           # Documentação
```

## Como Usar

### 1. Configuração Inicial

- Acesse a aba **Início**
- Configure o **Saldo Adicional Inicial** (dinheiro que você já possui)
- Ative o **Modo Escuro** se preferir
- Adicione **Categorias** personalizadas para suas despesas

### 2. Cadastrar Rendas

- Vá para a aba **Rendas**
- Adicione suas fontes de renda com nome, valor e dia de recebimento
- Exemplo: Salário, Freelance, Investimentos, etc.

### 3. Cadastrar Cartões

- Acesse a aba **Cartões**
- Cadastre seus cartões de crédito informando:
  - Nome do cartão
  - Limite
  - Dia de vencimento
  - Dia de fechamento da fatura

### 4. Adicionar Parcelamentos

- Na aba **Parcelamentos**, adicione compras parceladas:
  - Escolha o cartão
  - Informe a descrição
  - Valor da parcela (não o valor total)
  - Número de parcelas
  - Mês de início
  - Categoria

### 5. Cadastrar Contas

- Na aba **Contas**, registre suas despesas fixas:
  - Contas mensais (água, luz, internet, etc.)
  - Contas únicas (eventos pontuais)
  - Parcelamentos em dinheiro (empréstimos/financiamentos)

### 6. Visualizar Faturas

- Aba **Minhas Faturas**
- Selecione o mês para ver todas as faturas dos cartões
- Veja o total de cada cartão separadamente

### 7. Registrar Pagamentos

- Aba **Pagamentos**
- Marque as contas que já foram pagas
- Acompanhe o que ainda falta pagar no mês

### 8. Projeção Financeira

- Aba **Projeção**
- Defina quantos meses deseja projetar (1-12)
- Visualize:
  - Saldo inicial
  - Rendas
  - Despesas agrupadas por tipo (cartões, dinheiro, empréstimos)
  - Saldo final projetado
- Layout responsivo que se adapta ao tamanho da tela:
  - Desktop grande: 4 meses por linha
  - Desktop médio: 3 meses por linha
  - Tablet: 2 meses por linha
  - Mobile: 1 mês por linha

### 9. Histórico

- Aba **Histórico**
- Selecione um período para análise
- Veja gráficos e estatísticas dos seus gastos passados

### 10. Exportar Dados

- Na aba **Início**, clique em **Exportar para Excel**
- Baixe uma planilha completa com todos os seus dados

## API Endpoints

A aplicação possui uma API RESTful completa:

### Rendas
- `GET /api/rendas` - Listar rendas
- `POST /api/rendas` - Criar renda
- `PUT /api/rendas/:id` - Atualizar renda
- `DELETE /api/rendas/:id` - Deletar renda

### Cartões
- `GET /api/cartoes` - Listar cartões
- `POST /api/cartoes` - Criar cartão
- `PUT /api/cartoes/:id` - Atualizar cartão
- `DELETE /api/cartoes/:id` - Deletar cartão

### Parcelamentos
- `GET /api/parcelamentos` - Listar parcelamentos
- `POST /api/parcelamentos` - Criar parcelamento
- `PUT /api/parcelamentos/:id` - Atualizar parcelamento
- `DELETE /api/parcelamentos/:id` - Deletar parcelamento

### Contas
- `GET /api/contas` - Listar contas
- `POST /api/contas` - Criar conta
- `PUT /api/contas/:id` - Atualizar conta
- `DELETE /api/contas/:id` - Deletar conta

### Parcelamentos em Dinheiro
- `GET /api/parcelamentos-dinheiro` - Listar parcelamentos
- `POST /api/parcelamentos-dinheiro` - Criar parcelamento
- `PUT /api/parcelamentos-dinheiro/:id` - Atualizar parcelamento
- `DELETE /api/parcelamentos-dinheiro/:id` - Deletar parcelamento

### Categorias
- `GET /api/categorias` - Listar categorias
- `POST /api/categorias` - Criar categoria
- `DELETE /api/categorias/:nome` - Deletar categoria

### Pagamentos
- `GET /api/pagamentos` - Listar pagamentos
- `POST /api/pagamentos` - Registrar pagamento
- `DELETE /api/pagamentos/:chave` - Remover pagamento

### Configurações
- `GET /api/configuracoes` - Listar configurações
- `POST /api/configuracoes` - Salvar configuração

## Responsividade

O sistema é totalmente responsivo e se adapta automaticamente a diferentes dispositivos:

- **Desktop (≥1400px)**: Layout com 4 colunas na projeção
- **Laptop (1024-1399px)**: Layout com 3 colunas
- **Tablet (768-1023px)**: Layout com 2 colunas
- **Mobile (<768px)**: Layout com 1 coluna

## Persistência de Dados

Todos os dados são salvos automaticamente no arquivo `financeiro.db` usando SQLite. O banco de dados é persistido após cada operação, garantindo que você nunca perca suas informações.

## Atualização Automática

A interface atualiza automaticamente os dados a cada 5 segundos, garantindo que múltiplas abas ou janelas abertas permaneçam sincronizadas.

## Modo Escuro

O sistema possui suporte completo ao modo escuro, que pode ser ativado nas configurações. A preferência é salva automaticamente.

## Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abrir um Pull Request

## Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

## Suporte

Se você encontrar algum problema ou tiver sugestões, por favor abra uma issue no GitHub.

## Autor

Desenvolvido com dedicação para ajudar no controle financeiro pessoal.

---

**Controle suas finanças de forma simples e eficiente!**
