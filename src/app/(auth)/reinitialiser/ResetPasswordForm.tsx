"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorMessage } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));

    if (newPassword !== form.get("confirmation")) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setPending(false);

    if (error) setError(authErrorMessage(error));
    else setDone(true);
  }

  if (done) {
    return (
      <FieldGroup>
        <FieldDescription>Votre mot de passe a été changé et vos sessions ouvertes ont été fermées.</FieldDescription>
        <Button asChild>
          <Link href="/login">Se connecter</Link>
        </Button>
      </FieldGroup>
    );
  }

  return (
    <form onSubmit={reset}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">Nouveau mot de passe</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmation">Confirmation</FieldLabel>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Changer le mot de passe"}
        </Button>
      </FieldGroup>
    </form>
  );
}
