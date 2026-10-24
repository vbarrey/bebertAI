"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { acceptInvitation } from "./actions";

export function InvitationForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInvitation.bind(null, token), {});

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} disabled />
        </Field>
        <Field>
          <FieldLabel htmlFor="name">Nom</FieldLabel>
          <Input id="name" name="name" defaultValue={state.name} autoComplete="name" required maxLength={100} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmation">Confirmation du mot de passe</FieldLabel>
          <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required />
        </Field>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? "Création du compte…" : "Créer mon compte"}
        </Button>
      </FieldGroup>
    </form>
  );
}
