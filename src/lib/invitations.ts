import { createHash, randomBytes } from "node:crypto";

import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationUrl(token: string) {
  return `${process.env.APP_URL ?? "http://localhost:3000"}/invitation/${token}`;
}

/** Invites `email`, replacing its pending invitations: only the latest link works. */
export async function createInvitation(email: string, role: "admin" | "user", invitedById: string | null = null) {
  email = email.trim().toLowerCase();

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`Un compte existe déjà pour ${email}.`);
  }

  const token = randomBytes(32).toString("base64url");

  await prisma.$transaction([
    prisma.invitation.deleteMany({ where: { email, acceptedAt: null } }),
    prisma.invitation.create({
      data: { email, role, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VALIDITY_MS), invitedById },
    }),
  ]);

  await sendEmail({
    to: email,
    subject: "Invitation à Bebert AI",
    text: `Vous êtes invité à rejoindre Bebert AI. Pour créer votre compte, ouvrez ce lien (valable 7 jours) :\n${invitationUrl(token)}`,
  });
}

/** The invitation of the link, null when unknown, expired or already used. */
export async function findValidInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });

  return invitation && !invitation.acceptedAt && invitation.expiresAt > new Date() ? invitation : null;
}

/** Marks the invitation used; false when it was not valid anymore, so that a link creates a single account. */
export async function claimInvitation(id: string) {
  const { count } = await prisma.invitation.updateMany({
    where: { id, acceptedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });

  return count === 1;
}

/** Without any account yet, invites ADMIN_EMAIL as admin: a new link at each start until it is used. */
export async function inviteFirstAdmin() {
  if (await prisma.user.count()) return;

  const email = process.env.ADMIN_EMAIL;

  if (!email) {
    console.warn("Aucun compte : définissez ADMIN_EMAIL pour recevoir l'invitation du premier administrateur.");
    return;
  }

  await createInvitation(email, "admin");
  console.log(`Invitation du premier administrateur envoyée à ${email}.`);
}
