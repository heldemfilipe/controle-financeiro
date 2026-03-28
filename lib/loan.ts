// ─── Calculadora de Empréstimo / Financiamento ──────────────────────────────

export type LoanMethod = "price" | "sac";

export interface LoanParams {
  /** Valor do empréstimo */
  amount: number;
  /** Taxa de juros mensal (ex: 0.02 = 2%) */
  monthlyRate: number;
  /** Número de parcelas */
  installments: number;
  /** Método: Price (parcela fixa) ou SAC (amortização fixa) */
  method: LoanMethod;
  /** Mês de início (1-12) */
  startMonth: number;
  /** Ano de início */
  startYear: number;
}

export interface AmortizationRow {
  /** Número da parcela (1-based) */
  installment: number;
  month: number;
  year: number;
  /** Valor da parcela (juros + amortização) */
  payment: number;
  /** Porção de juros */
  interest: number;
  /** Porção de amortização (principal) */
  principal: number;
  /** Saldo devedor após pagamento */
  remaining: number;
}

export interface LoanSummary {
  /** Soma de todas as parcelas */
  totalPaid: number;
  /** Total de juros pagos */
  totalInterest: number;
  /** Custo efetivo: totalPaid / amount */
  effectiveCost: number;
  /** Valor da primeira parcela */
  firstPayment: number;
  /** Valor da última parcela */
  lastPayment: number;
}

// ─── Tabela Price (parcela fixa) ─────────────────────────────────────────────

function calcPrice(params: LoanParams): AmortizationRow[] {
  const { amount, monthlyRate, installments, startMonth, startYear } = params;
  const rows: AmortizationRow[] = [];

  let remaining = amount;
  const pmt = monthlyRate > 0
    ? amount * (monthlyRate * Math.pow(1 + monthlyRate, installments)) /
      (Math.pow(1 + monthlyRate, installments) - 1)
    : amount / installments; // sem juros

  for (let i = 1; i <= installments; i++) {
    const interest = remaining * monthlyRate;
    const principal = pmt - interest;
    remaining = Math.max(remaining - principal, 0);

    // Calcula mês/ano
    const totalMonths = (startYear * 12 + startMonth - 1) + (i - 1);
    const month = (totalMonths % 12) + 1;
    const year = Math.floor(totalMonths / 12);

    rows.push({
      installment: i,
      month, year,
      payment: round2(pmt),
      interest: round2(interest),
      principal: round2(principal),
      remaining: round2(remaining),
    });
  }

  return rows;
}

// ─── Tabela SAC (amortização constante) ──────────────────────────────────────

function calcSAC(params: LoanParams): AmortizationRow[] {
  const { amount, monthlyRate, installments, startMonth, startYear } = params;
  const rows: AmortizationRow[] = [];

  let remaining = amount;
  const fixedPrincipal = amount / installments;

  for (let i = 1; i <= installments; i++) {
    const interest = remaining * monthlyRate;
    const payment = fixedPrincipal + interest;
    remaining = Math.max(remaining - fixedPrincipal, 0);

    const totalMonths = (startYear * 12 + startMonth - 1) + (i - 1);
    const month = (totalMonths % 12) + 1;
    const year = Math.floor(totalMonths / 12);

    rows.push({
      installment: i,
      month, year,
      payment: round2(payment),
      interest: round2(interest),
      principal: round2(fixedPrincipal),
      remaining: round2(remaining),
    });
  }

  return rows;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export function calculateAmortization(params: LoanParams): AmortizationRow[] {
  if (params.amount <= 0 || params.installments <= 0) return [];
  return params.method === "sac" ? calcSAC(params) : calcPrice(params);
}

export function loanSummary(rows: AmortizationRow[]): LoanSummary {
  if (rows.length === 0) {
    return { totalPaid: 0, totalInterest: 0, effectiveCost: 0, firstPayment: 0, lastPayment: 0 };
  }
  const totalPaid = rows.reduce((s, r) => s + r.payment, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const principal = rows.reduce((s, r) => s + r.principal, 0);
  return {
    totalPaid: round2(totalPaid),
    totalInterest: round2(totalInterest),
    effectiveCost: principal > 0 ? round2(totalPaid / principal) : 0,
    firstPayment: rows[0].payment,
    lastPayment: rows[rows.length - 1].payment,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
