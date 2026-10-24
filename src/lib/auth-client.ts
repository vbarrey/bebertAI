import { createAuthClient } from "better-auth/react";

// Through /api/auth, unlike auth.api calls on the server: the rate limit applies to sign-in and resets.
export const authClient = createAuthClient();

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  BANNED_USER: "Ce compte est désactivé. Contactez votre administrateur.",
  INVALID_TOKEN: "Ce lien est expiré ou a déjà été utilisé.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 8 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
};

export function authErrorMessage(error: { code?: string; status?: number }) {
  if (error.status === 429) return "Trop de tentatives. Réessayez dans quelques instants.";

  return (error.code && MESSAGES[error.code]) ?? "Une erreur est survenue. Réessayez.";
}
