import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findValidInvitation } from "@/lib/invitations";
import { InvitationForm } from "./InvitationForm";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findValidInvitation(token);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Bienvenue sur Bebert AI</CardTitle>
        <CardDescription>
          {invitation
            ? "Choisissez votre nom et votre mot de passe pour créer votre compte."
            : "Ce lien d'invitation est expiré ou a déjà été utilisé. Demandez une nouvelle invitation à votre administrateur."}
        </CardDescription>
      </CardHeader>
      {invitation && (
        <CardContent>
          <InvitationForm token={token} email={invitation.email} />
        </CardContent>
      )}
    </Card>
  );
}
