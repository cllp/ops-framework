/**
 * Nodemailer 7 skickar inte med egna typer. Deklarationen täcker bara det
 * utskickaren anropar: `createTransport` och `sendMail`. Resten av paketet
 * är inte ramverkets yta.
 */
declare module "nodemailer" {
  interface Mejltransport {
    sendMail(meddelande: Record<string, unknown>): Promise<Record<string, unknown>>;
  }
  export function createTransport(installningar: Record<string, unknown>): Mejltransport;
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
