/**
 * Central company / tax / payment details for 4K Smart Solutions.
 * Used across all printable documents (invoices, delivery notes, credit notes,
 * statements, thermal receipts) so a single edit updates the whole system.
 */
export const COMPANY = {
  name: "4K SMART SOLUTIONS LTD",
  tagline: "Smart Business. Smarter Solutions.",
  services: "Phone Accessories · Internet · Printing",
  address: "P.O BOX 2706, KAKAMEGA",
  phone: "0736217411",
  email: "4ksmartsolutionsltd@gmail.com",
  website: "www.4ksmart.co.ke",

  // KRA / tax
  kraPin: "P052399943U",

  // Payment
  paybill: "4183147",
  paybillAccount: "4KSmart",
} as const;
