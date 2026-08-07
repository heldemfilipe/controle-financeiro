"use client";

import { AlertCircle, Trash2, Calculator } from "lucide-react";
import { formatCurrency, getMonthName, computeInstallment } from "@/lib/utils";
import { calculateAmortization, loanSummary } from "@/lib/loan";
import { isBillActiveInYear, remainingInstallments, isModValid } from "@/lib/simulador/applyMods";
import type { ScenarioMod, ModType } from "@/lib/simulador/applyMods";
import type { FixedBill } from "@/types";

const MOD_LABELS: Record<ModType, string> = {
  remove_bill:          "Remover conta fixa (mensal)",
  pay_off_installment:  "Quitar parcelamento / financiamento de uma vez",
  add_expense:          "Nova despesa mensal",
  income_change:        "Alterar renda mensal (+/-)",
  one_time_income:      "Receita avulsa (unico mes)",
  one_time_expense:     "Despesa avulsa (unico mes)",
  loan:                 "Novo emprestimo / Financiamento",
};

const MOD_EXAMPLES: Record<ModType, string> = {
  remove_bill:          "Ex: cancelar academia, encerrar plano",
  pay_off_installment:  "Ex: quitar carro, pagar emprestimo, antecipar parcelas",
  add_expense:          "Ex: novo plano de saude, academia",
  income_change:        "Ex: +1.000 aumento, -500 reducao",
  one_time_income:      "Ex: venda de veiculo, FGTS, bonus",
  one_time_expense:     "Ex: IPTU a vista, cirurgia, viagem",
  loan:                 "Ex: emprestimo pessoal, financiamento de carro",
};

const MONTH_OPTS = Array.from({ length: 12 }, (_, i) => i + 1);

interface ModCardProps {
  mod: ScenarioMod;
  idx: number;
  year: number;
  bills: FixedBill[];
  onUpdate: (id: string, patch: Partial<ScenarioMod>) => void;
  onRemove: (id: string) => void;
}

export function ModCard({ mod, idx, year, bills, onUpdate, onRemove }: ModCardProps) {
  const isOneTime = mod.type === "one_time_income" || mod.type === "one_time_expense";
  const valid = isModValid(mod);

  return (
    <div className={`border rounded-xl p-3 space-y-2.5 ${
      valid
        ? "border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/20"
        : "border-amber-200 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-900/10"
    }`}>

      {/* Header: número + tipo + badge + delete */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-primary-500 w-5 shrink-0">#{idx + 1}</span>
        <select
          value={mod.type}
          onChange={e => {
            const type = e.target.value as ModType;
            const isOT = type === "one_time_income" || type === "one_time_expense";
            onUpdate(mod.id, {
              type,
              endMonth: isOT ? mod.startMonth : 12,
              // Fixa o ano de contratação do empréstimo ao ano sendo exibido no momento da criação
              loanStartYear: type === "loan" ? (mod.loanStartYear ?? year) : mod.loanStartYear,
            });
          }}
          className="flex-1 text-xs font-medium bg-white dark:bg-slate-700
                     border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5
                     text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {(Object.entries(MOD_LABELS) as [ModType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {!valid && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
            <AlertCircle size={11} /> Incompleto
          </span>
        )}
        <button
          onClick={() => onRemove(mod.id)}
          className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Exemplo hint */}
      <p className="text-xs text-slate-400 pl-7">{MOD_EXAMPLES[mod.type]}</p>

      {/* Campos dinâmicos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">

        {/* Empréstimo */}
        {mod.type === "loan" && (
          <>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Valor do emprestimo (R$)</label>
              <input
                type="number" step="100"
                value={mod.amount || ""}
                onChange={e => onUpdate(mod.id, { amount: parseFloat(e.target.value) || 0 })}
                placeholder="10000"
                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Taxa mensal (%)</label>
              <input
                type="number" step="0.1"
                value={mod.loanRate ?? ""}
                onChange={e => onUpdate(mod.id, { loanRate: parseFloat(e.target.value) || 0 })}
                placeholder="2.0"
                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Parcelas</label>
              <input
                type="number" min="1" max="360"
                value={mod.loanInstallments ?? ""}
                onChange={e => onUpdate(mod.id, { loanInstallments: parseInt(e.target.value) || 0 })}
                placeholder="12"
                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Metodo</label>
              <select
                value={mod.loanMethod ?? "price"}
                onChange={e => onUpdate(mod.id, { loanMethod: e.target.value as "price" | "sac" })}
                className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                           rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="price">Price (parcela fixa)</option>
                <option value="sac">SAC (amortizacao fixa)</option>
              </select>
            </div>
          </>
        )}

        {/* Conta (remove_bill) — só mostra contas ativas no ano */}
        {mod.type === "remove_bill" && (
          <div className="sm:col-span-1">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Conta a remover</label>
            <select
              value={mod.billId}
              onChange={e => onUpdate(mod.id, { billId: e.target.value })}
              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                         rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Selecione…</option>
              {bills.filter(b => isBillActiveInYear(b, year)).map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({formatCurrency(b.amount)}/mês)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quitar parcelamento de uma vez — só mostra contas ativas no ano */}
        {mod.type === "pay_off_installment" && (() => {
          const activeBills = bills.filter(b => isBillActiveInYear(b, year));
          const selectedBill = bills.find(b => b.id === mod.billId);
          const autoAmount = selectedBill
            ? remainingInstallments(selectedBill, mod.startMonth, year) * selectedBill.amount
            : 0;
          return (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Parcelamento / financiamento a quitar</label>
                <select
                  value={mod.billId}
                  onChange={e => onUpdate(mod.id, { billId: e.target.value, payoffAmount: undefined })}
                  className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                             rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Selecione…</option>
                  {activeBills.filter(b => b.installment_total).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({formatCurrency(b.amount)}/mês · {b.installment_total}x)
                    </option>
                  ))}
                  {activeBills.filter(b => !b.installment_total).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({formatCurrency(b.amount)}/mês)
                    </option>
                  ))}
                </select>
              </div>
              {mod.billId && (
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                    Valor da quitação (R$)
                    {autoAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => onUpdate(mod.id, { payoffAmount: undefined })}
                        className="ml-2 text-primary-500 hover:underline text-[10px]"
                      >
                        {mod.payoffAmount != null ? "usar auto" : `auto: ${formatCurrency(autoAmount)}`}
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={mod.payoffAmount ?? ""}
                    placeholder={autoAmount > 0 ? formatCurrency(autoAmount).replace("R$ ", "") : "valor da quitação"}
                    onChange={e => onUpdate(mod.id, {
                      payoffAmount: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                    })}
                    className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                               rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              )}
            </>
          );
        })()}

        {/* Valor (tudo exceto remove_bill, loan e pay_off_installment) */}
        {mod.type !== "remove_bill" && mod.type !== "loan" && mod.type !== "pay_off_installment" && (
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              {mod.type === "income_change" ? "Valor R$ (+/-)" : "Valor R$"}
            </label>
            <input
              type="number"
              value={mod.amount || ""}
              onChange={e => onUpdate(mod.id, { amount: parseFloat(e.target.value) || 0 })}
              placeholder={mod.type === "income_change" ? "+500 ou -200" : "0,00"}
              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                         rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        )}

        {/* De (mês início) */}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
            {isOneTime ? "Mes" : mod.type === "loan" ? `Mes do emprestimo (${mod.loanStartYear ?? year})` : mod.type === "pay_off_installment" ? "Mes da quitacao" : "A partir de"}
          </label>
          <select
            value={mod.startMonth}
            onChange={e => {
              const v = +e.target.value;
              onUpdate(mod.id, {
                startMonth: v,
                endMonth: isOneTime ? v : Math.max(mod.endMonth, v),
              });
            }}
            className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                       rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {MONTH_OPTS.map(m => <option key={m} value={m}>{getMonthName(m)}</option>)}
          </select>
        </div>

        {/* Até (mês fim) — oculto para one-time, loan e pay_off */}
        {!isOneTime && mod.type !== "loan" && mod.type !== "pay_off_installment" && (
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Até</label>
            <select
              value={mod.endMonth}
              onChange={e => onUpdate(mod.id, { endMonth: +e.target.value })}
              className="w-full text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                         rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {MONTH_OPTS.filter(m => m >= mod.startMonth).map(m => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Preview do impacto mensal */}
      {mod.type === "remove_bill" && mod.billId && (() => {
        const bill = bills.find(b => b.id === mod.billId);
        if (!bill) return null;
        // Conta apenas meses em que a parcela está ativa no ano
        const activeMonths = MONTH_OPTS.filter(m => {
          if (m < mod.startMonth || m > mod.endMonth) return false;
          if (!bill.installment_total || bill.installment_start_month == null || bill.installment_start_year == null) return true;
          return computeInstallment(bill, m, year) !== null;
        });
        if (activeMonths.length === 0) return (
          <p className="pl-7 text-xs text-amber-500">Parcela encerra antes do período selecionado</p>
        );
        return (
          <div className="pl-7 flex gap-4 text-xs">
            <span className="text-emerald-600 font-semibold">
              +{formatCurrency(bill.amount)}/mês economizado
            </span>
            <span className="text-emerald-500">
              +{formatCurrency(bill.amount * activeMonths.length)} em {activeMonths.length} mês{activeMonths.length > 1 ? "es" : ""}
            </span>
          </div>
        );
      })()}
      {/* Preview: quitar parcelamento */}
      {mod.type === "pay_off_installment" && mod.billId && (() => {
        const bill = bills.find(b => b.id === mod.billId);
        if (!bill) return null;
        const remaining = remainingInstallments(bill, mod.startMonth, year);
        const autoTotal = remaining * bill.amount;
        const totalCost = mod.payoffAmount != null && mod.payoffAmount > 0 ? mod.payoffAmount : autoTotal;
        const monthsSaved = Math.max(0, 12 - mod.startMonth);
        const savedInYear = monthsSaved * bill.amount;
        const isCustom = mod.payoffAmount != null && mod.payoffAmount > 0;
        return (
          <div className="pl-7 space-y-1 text-xs">
            <div className="flex flex-wrap gap-4 items-center">
              <span className="text-red-500 font-semibold">
                -{formatCurrency(totalCost)} em {getMonthName(mod.startMonth)}
                {isCustom && <span className="ml-1 text-amber-500">(valor customizado)</span>}
              </span>
              {!isCustom && remaining > 0 && (
                <span className="text-slate-400">
                  {remaining} parcelas × {formatCurrency(bill.amount)}
                </span>
              )}
              {isCustom && autoTotal > 0 && (
                <span className="text-slate-400">auto seria {formatCurrency(autoTotal)}</span>
              )}
            </div>
            {savedInYear > 0 && (
              <div className="text-emerald-600">
                +{formatCurrency(savedInYear)} economizado no restante do ano ({monthsSaved} meses sem parcela)
              </div>
            )}
          </div>
        );
      })()}
      {/* Loan amortization preview */}
      {mod.type === "loan" && mod.amount > 0 && (mod.loanInstallments ?? 0) > 0 && (mod.loanRate ?? 0) >= 0 && (() => {
        const rows = calculateAmortization({
          amount: mod.amount,
          monthlyRate: (mod.loanRate ?? 0) / 100,
          installments: mod.loanInstallments ?? 12,
          method: mod.loanMethod ?? "price",
          startMonth: mod.startMonth,
          startYear: mod.loanStartYear ?? year,
        });
        const summary = loanSummary(rows);
        return (
          <div className="pl-7 space-y-2">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-slate-500">Parcela: <b className="text-red-500">{formatCurrency(summary.firstPayment)}/mes</b></span>
              {summary.firstPayment !== summary.lastPayment && (
                <span className="text-slate-500">Ultima: <b className="text-red-500">{formatCurrency(summary.lastPayment)}</b></span>
              )}
              <span className="text-slate-500">Total pago: <b className="text-slate-700 dark:text-slate-200">{formatCurrency(summary.totalPaid)}</b></span>
              <span className="text-slate-500">Juros: <b className="text-amber-600">{formatCurrency(summary.totalInterest)}</b></span>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1">
                <Calculator size={11} /> Ver tabela de amortizacao ({rows.length} parcelas)
              </summary>
              <div className="mt-2 max-h-48 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-xs min-w-[420px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-slate-500">#</th>
                      <th className="text-left px-2 py-1.5 text-slate-500">Mes</th>
                      <th className="text-right px-2 py-1.5 text-slate-500">Parcela</th>
                      <th className="text-right px-2 py-1.5 text-slate-500">Juros</th>
                      <th className="text-right px-2 py-1.5 text-slate-500">Amort.</th>
                      <th className="text-right px-2 py-1.5 text-slate-500">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.installment} className="border-t border-slate-100 dark:border-slate-700/30">
                        <td className="px-2 py-1 text-slate-400">{r.installment}</td>
                        <td className="px-2 py-1 text-slate-600 dark:text-slate-300">{getMonthName(r.month).slice(0,3)}/{r.year}</td>
                        <td className="px-2 py-1 text-right text-red-500 tabular-nums">{formatCurrency(r.payment)}</td>
                        <td className="px-2 py-1 text-right text-amber-500 tabular-nums">{formatCurrency(r.interest)}</td>
                        <td className="px-2 py-1 text-right text-emerald-500 tabular-nums">{formatCurrency(r.principal)}</td>
                        <td className="px-2 py-1 text-right text-slate-600 dark:text-slate-300 tabular-nums">{formatCurrency(r.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      })()}
      {mod.type !== "remove_bill" && mod.type !== "loan" && mod.amount !== 0 && (() => {
        const months = isOneTime ? 1 : mod.endMonth - mod.startMonth + 1;
        const isPositive = mod.type === "income_change" || mod.type === "one_time_income"
          ? mod.amount > 0
          : mod.amount < 0;
        const total = Math.abs(mod.amount) * months;
        return (
          <div className="pl-7 flex gap-4 text-xs">
            <span className={`font-semibold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
              {isPositive ? "+" : "-"}{formatCurrency(Math.abs(mod.amount))}/mês
            </span>
            {!isOneTime && (
              <span className={isPositive ? "text-emerald-500" : "text-red-400"}>
                {isPositive ? "+" : "-"}{formatCurrency(total)} em {months} meses
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
