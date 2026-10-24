"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createInvitation } from "@/lib/invitations";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const USERS_PATH = "/settings/utilisateurs";

const InvitationSchema = z.object({
  email: z.email("Adresse email invalide."),
  role: z.enum(["admin", "user"]),
});

export type UserActionResult = { error?: string };

export async function inviteUser(formData: FormData): Promise<UserActionResult> {
  const admin = await requireAdmin();
  const parsed = InvitationSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  try {
    await createInvitation(parsed.data.email, parsed.data.role, admin.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "L'invitation n'a pas pu être envoyée." };
  }

  revalidatePath(USERS_PATH);
  return {};
}

/** Sends a new link, the previous one stops working. */
export async function resendInvitation(invitationId: string): Promise<UserActionResult> {
  const admin = await requireAdmin();
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });

  if (!invitation || invitation.acceptedAt) return { error: "Cette invitation n'existe plus." };

  try {
    await createInvitation(invitation.email, invitation.role as "admin" | "user", admin.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "L'invitation n'a pas pu être renvoyée." };
  }

  revalidatePath(USERS_PATH);
  return {};
}

export async function cancelInvitation(invitationId: string): Promise<UserActionResult> {
  await requireAdmin();
  await prisma.invitation.deleteMany({ where: { id: invitationId, acceptedAt: null } });

  revalidatePath(USERS_PATH);
  return {};
}

/** A disabled account can no longer sign in and its sessions are closed; its data is kept. */
export async function setUserDisabled(userId: string, disabled: boolean): Promise<UserActionResult> {
  const admin = await requireAdmin();

  if (userId === admin.id) return { error: "Vous ne pouvez pas désactiver votre propre compte." };

  const request = { body: { userId }, headers: await headers() };

  await (disabled ? auth.api.banUser(request) : auth.api.unbanUser(request));

  revalidatePath(USERS_PATH);
  return {};
}
