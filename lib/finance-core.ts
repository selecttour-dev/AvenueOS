// Actuals P&L math — the single source of truth for how the venue's real
// profit is derived from the ledger. Pure (no db imports) so it can be reused
// by any query or client. Forward-looking projections live in forecast-shared.

export type LedgerLike = { type: string; amount: number; qty: number };

/** Sum ledger rows into income vs costs (expense + wage). One row's value is
 *  amount × qty (qty defaults to 1 for money entries, >1 for counted items). */
export function sumLedger(rows: LedgerLike[]): { income: number; costs: number } {
  let income = 0;
  let costs = 0;
  for (const r of rows) {
    const t = r.amount * r.qty;
    if (r.type === "income") income += t;
    else costs += t; // "expense" | "wage"
  }
  return { income, costs };
}

export type ProfitInput = {
  income: number;
  costs: number;
  /** One-off operational expenses for the venue (operationalExpenses, kind='operational'). */
  operational: number;
  /** Income-tax rate as a percentage (e.g. 1 means 1%). */
  taxPct: number;
};

export type ProfitSummary = {
  income: number;
  costs: number;
  /** Raw day-to-day profit from the register: income − costs. */
  dayProfit: number;
  /** Income tax: income × taxPct / 100. */
  tax: number;
  operational: number;
  /** What's left to split between partners: dayProfit − operational − tax. */
  distributable: number;
  /** dayProfit / income (0 when there's no income). */
  margin: number;
};

/** The canonical profit waterfall. Every actuals view (overview, partners,
 *  finance) must derive its numbers from here so they can never diverge. */
export function profitSummary(input: ProfitInput): ProfitSummary {
  const { income, costs, operational, taxPct } = input;
  const dayProfit = income - costs;
  const tax = (income * taxPct) / 100;
  const distributable = dayProfit - operational - tax;
  return {
    income,
    costs,
    dayProfit,
    tax,
    operational,
    distributable,
    margin: income > 0 ? dayProfit / income : 0,
  };
}

/** A single partner's cut of the distributable profit. Inactive partners get 0. */
export function allocateToPartner(
  distributable: number,
  sharePct: number,
  active = true,
): number {
  return active ? (distributable * sharePct) / 100 : 0;
}
