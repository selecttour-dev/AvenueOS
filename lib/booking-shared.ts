// Shared between server and client — must stay free of db imports.

export type BookingRow = {
  id: number;
  title: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  pricePerGuest: number;
  extraCharges: number;
  discount: number;
  status: string;
  notes: string | null;
  clientName: string | null;
  clientPhone: string | null;
  paidTotal: number;
};

export function bookingTotal(b: {
  guestCount: number;
  pricePerGuest: number;
  extraCharges: number;
  discount: number;
}): number {
  return b.guestCount * b.pricePerGuest + b.extraCharges - b.discount;
}

export const STATUS_LABELS: Record<string, string> = {
  inquiry: "მოთხოვნა",
  tentative: "წინასწარი",
  confirmed: "დადასტურებული",
  completed: "ჩატარებული",
  cancelled: "გაუქმებული",
};

export const STATUS_ORDER = [
  "inquiry",
  "tentative",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "ნაღდი",
  transfer: "გადარიცხვა",
  card: "ბარათი",
};

/** Common suggested categories for event expenses. */
export const EXPENSE_CATEGORIES = [
  "პროდუქტი",
  "სასმელი",
  "მომსახურე პერსონალი",
  "მუსიკა / DJ",
  "დეკორი",
  "ტრანსპორტი",
  "სხვა",
];
