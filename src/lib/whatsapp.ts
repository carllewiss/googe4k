// Central WhatsApp deeplink helper.
// Business number: 0736217411 -> international format 254736217411

export const WHATSAPP_BUSINESS_NUMBER = "254736217411";
export const WHATSAPP_DISPLAY = "0736 217 411";

export function buildWaLink(message: string): string {
  return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function serviceInquiryMessage(serviceName: string, customerName?: string): string {
  const intro = customerName
    ? `Hello 4K Smart Solutions, my name is ${customerName}.`
    : `Hello 4K Smart Solutions,`;
  return `${intro}\n\nI would like to inquire about: *${serviceName}*\n\nPlease assist me with the next steps. Thank you.`;
}
