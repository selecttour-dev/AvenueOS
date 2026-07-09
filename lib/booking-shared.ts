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
