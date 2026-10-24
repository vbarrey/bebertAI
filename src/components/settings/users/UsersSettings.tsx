"use client";

import { useRef, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { cancelInvitation, inviteUser, resendInvitation, setUserDisabled, type UserActionResult } from "@/lib/mutations/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TruncatedText } from "@/components/ui/truncated-text";

type User = { id: string; name: string; email: string; role: string | null; banned: boolean | null; createdAt: Date };
type Invitation = { id: string; email: string; role: string; expiresAt: Date };

type UsersSettingsProps = {
  currentUserId: string;
  users: User[];
  invitations: Invitation[];
};

const ROLE_LABELS: Record<string, string> = { admin: "Administrateur", user: "Utilisateur" };

export function UsersSettings({ currentUserId, users, invitations }: UsersSettingsProps) {
  const [pending, startTransition] = useTransition();
  const inviteForm = useRef<HTMLFormElement>(null);

  function run(action: () => Promise<UserActionResult>, success: string, then?: () => void) {
    startTransition(async () => {
      const { error } = await action();

      if (error) {
        toast.error(error);
        return;
      }

      toast.success(success);
      then?.();
    });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container flex w-full max-w-3xl flex-col gap-8 p-4">
        <h2 className="text-xl">Utilisateurs</h2>

        <section className="space-y-3">
          <h3 className="font-medium">Inviter une personne</h3>
          <form
            ref={inviteForm}
            action={(formData) =>
              run(() => inviteUser(formData), `Invitation envoyée à ${formData.get("email")}.`, () => inviteForm.current?.reset())
            }
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input name="email" type="email" placeholder="email@exemple.fr" aria-label="Email" required className="sm:flex-1" />
            <Select name="role" defaultValue="user">
              <SelectTrigger aria-label="Rôle" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={pending}>Inviter</Button>
          </form>
          <p className="text-xs text-muted-foreground">La personne reçoit par email un lien valable 7 jours pour créer son compte.</p>
        </section>

        {invitations.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-medium">Invitations en attente</h3>
            <ul className="divide-y rounded-md border">
              {invitations.map((invitation) => {
                const expired = invitation.expiresAt < new Date();

                return (
                  <li key={invitation.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <TruncatedText className="text-sm font-medium">{invitation.email}</TruncatedText>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[invitation.role]} ·{" "}
                        {expired
                          ? "expirée"
                          : `expire ${formatDistanceToNow(invitation.expiresAt, { addSuffix: true, locale: fr })}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => resendInvitation(invitation.id), `Nouvelle invitation envoyée à ${invitation.email}.`)}
                      >
                        Renvoyer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => cancelInvitation(invitation.id), "Invitation annulée.")}
                      >
                        Annuler
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h3 className="font-medium">Comptes</h3>
          <ul className="divide-y rounded-md border">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <TruncatedText className="text-sm font-medium">{user.name}</TruncatedText>
                    {user.id === currentUserId && <span className="shrink-0 text-xs text-muted-foreground">(vous)</span>}
                  </div>
                  <TruncatedText className="text-xs text-muted-foreground">{user.email}</TruncatedText>
                </div>
                <div className="flex items-center gap-2">
                  {user.banned && <Badge variant="destructive">Désactivé</Badge>}
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{ROLE_LABELS[user.role ?? "user"]}</Badge>
                  {user.id !== currentUserId && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => setUserDisabled(user.id, !user.banned),
                          user.banned ? `${user.name} peut de nouveau se connecter.` : `${user.name} ne peut plus se connecter.`,
                        )
                      }
                    >
                      {user.banned ? "Réactiver" : "Désactiver"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
