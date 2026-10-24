type Email = {
  to: string;
  subject: string;
  text: string;
};

// No sender configured yet: the email goes to the logs, links included.
export async function sendEmail({ to, subject, text }: Email) {
  console.log(`[email] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
}
