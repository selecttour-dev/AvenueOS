// Forecast / business-model math — pure, shared between server and client.

export type ModelParams = {
  eventsPerMonth: number;
  avgGuests: number;
  pricePerGuest: number;
  foodCostPerGuest: number;
  serviceCostPerEvent: number;
};

export const PARAM_KEYS: (keyof ModelParams)[] = [
  "eventsPerMonth",
  "avgGuests",
  "pricePerGuest",
  "foodCostPerGuest",
  "serviceCostPerEvent",
];

// Relative event volume per month (Georgian event/wedding seasonality).
// Normalised at use time so the average month = 1.0.
export const SEASONALITY = [
  0.5, 0.55, 0.7, 0.95, 1.35, 1.45, 1.3, 1.25, 1.5, 1.15, 0.6, 0.7,
];

export function revenuePerEvent(p: ModelParams): number {
  return p.avgGuests * p.pricePerGuest;
}

/** Profit an average event contributes before fixed costs. */
export function contributionPerEvent(p: ModelParams): number {
  return (
    p.avgGuests * (p.pricePerGuest - p.foodCostPerGuest) - p.serviceCostPerEvent
  );
}

export function monthlyRevenue(p: ModelParams): number {
  return p.eventsPerMonth * revenuePerEvent(p);
}

export function monthlyProfit(p: ModelParams, monthlyFixed: number): number {
  return p.eventsPerMonth * contributionPerEvent(p) - monthlyFixed;
}

export function annualProfit(p: ModelParams, monthlyFixed: number): number {
  return monthlyProfit(p, monthlyFixed) * 12;
}

/** Events per (average) month needed to cover fixed costs. */
export function breakEvenEvents(
  p: ModelParams,
  monthlyFixed: number,
): number | null {
  const c = contributionPerEvent(p);
  if (c <= 0) return null;
  return monthlyFixed / c;
}

export type MonthProjection = {
  month: number; // 0-11
  events: number;
  revenue: number;
  variableCost: number;
  profit: number;
};

export function monthlyProjection(
  p: ModelParams,
  monthlyFixed: number,
): MonthProjection[] {
  const sum = SEASONALITY.reduce((s, w) => s + w, 0);
  const norm = 12 / sum;
  return SEASONALITY.map((w, i) => {
    const events = p.eventsPerMonth * w * norm;
    const revenue = events * revenuePerEvent(p);
    const variableCost =
      events * p.avgGuests * p.foodCostPerGuest + events * p.serviceCostPerEvent;
    return {
      month: i,
      events,
      revenue,
      variableCost,
      profit: revenue - variableCost - monthlyFixed,
    };
  });
}

export type Sensitivity = { label: string; delta: number };

/** Annual-profit impact of a set of single-lever tweaks. */
export function sensitivity(
  p: ModelParams,
  monthlyFixed: number,
): Sensitivity[] {
  const base = annualProfit(p, monthlyFixed);
  const d = (np: ModelParams, mf = monthlyFixed) =>
    annualProfit(np, mf) - base;
  return [
    { label: "ფასი +5₾ სტუმარზე", delta: d({ ...p, pricePerGuest: p.pricePerGuest + 5 }) },
    { label: "კვების ღირ. −5₾ სტუმარზე", delta: d({ ...p, foodCostPerGuest: p.foodCostPerGuest - 5 }) },
    { label: "+1 ივენთი თვეში", delta: d({ ...p, eventsPerMonth: p.eventsPerMonth + 1 }) },
    { label: "+10 სტუმარი ივენთზე", delta: d({ ...p, avgGuests: p.avgGuests + 10 }) },
    { label: "ფიქს. ხარჯი −500₾/თვე", delta: d(p, monthlyFixed - 500) },
  ].sort((a, b) => b.delta - a.delta);
}
