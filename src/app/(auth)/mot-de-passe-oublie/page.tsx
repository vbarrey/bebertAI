"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorMessage } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reinitialiser",
    });
    setPending(false);

    if (error) setError(authErrorMessage(error));
    else setSent(true);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          {sent
            // Same answer whether the account exists or not.
            ? "Si un compte existe pour cette adresse, un email avec un lien de réinitialisation vient de lui être envoyé. Le lien est valable 1 heure."
            : "Indiquez votre email, nous vous enverrons un lien pour choisir un nouveau mot de passe."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Retour à la connexion</Link>
          </Button>
        ) : (
          <form onSubmit={requestReset}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Button type="submit" disabled={pending}>
                {pending ? "Envoi…" : "Envoyer le lien"}
              </Button>
              <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
                Retour à la connexion
              </Link>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
