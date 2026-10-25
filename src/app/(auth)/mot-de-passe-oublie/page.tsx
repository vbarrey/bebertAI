import type { Metadata } from "next";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Mot de passe oublié" };

// The form is a Client Component, which cannot export metadata: this page, on the server, does.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
