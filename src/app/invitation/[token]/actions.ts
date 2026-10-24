"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { claimInvitation, findValidInvitation } from "@/lib/invitations";
import { prisma } from "@/lib/prisma";

const AccountSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est requis.").max(100),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128),
    confirmation: z.string(),
  })
  .refine((account) => account.password === account.confirmation, {
    message: "Les mots de passe ne correspondent pas.",
  });

// The name comes back to refill the form, which React resets after the action.
export type AcceptInvitationState = { error?: string; name?: string };

export async function acceptInvitation(
  token: string,
  _state: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const parsed = AccountSchema.safeParse(Object.fromEntries(formData));
  const submittedName = String(formData.get("name") ?? "");

  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message, name: submittedName };
  }

  const invitation = await findValidInvitation(token);

  if (!invitation || !(await claimInvitation(invitation.id))) {
    return { error: "Cette invitation n'est plus valable.", name: submittedName };
  }

  const { name, password } = parsed.data;

  try {
    await auth.api.createUser({
      body: { email: invitation.email, password, name, role: invitation.role as "admin" | "user" },
    });
  } catch (error) {
    // The link stays usable for another try.
    await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: null } });
    console.error("Account creation from an invitation failed:", error);
    return { error: "Le compte n'a pas pu être créé. Réessayez.", name: submittedName };
  }

  // Sets the session cookie (nextCookies plugin).
  await auth.api.signInEmail({ body: { email: invitation.email, password }, headers: await headers() });

  redirect("/");
}
