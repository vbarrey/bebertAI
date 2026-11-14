import nodemailer from "nodemailer";

import { env } from "@/lib/env";

type Email = {
  to: string;
  subject: string;
  text: string;
};

// Port 465: TLS from the start; any other (587): STARTTLS, required.
const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT !== 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

// No SMTP server configured: the email goes to the logs, links included.
export async function sendEmail({ to, subject, text }: Email) {
  if (!transport) {
    console.log(`[email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }

  await transport.sendMail({ from: env.EMAIL_FROM ?? env.SMTP_USER, to, subject, text });
}
