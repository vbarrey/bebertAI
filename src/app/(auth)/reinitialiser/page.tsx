import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./ResetPasswordForm";

// Reached from the email link: Better Auth checks the token, then redirects here with it, or with an error.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Nouveau mot de passe</CardTitle>
        {!token && <CardDescription>Ce lien est expiré ou a déjà été utilisé. Demandez-en un nouveau.</CardDescription>}
      </CardHeader>
      <CardContent>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Button variant="outline" className="w-full" asChild>
            <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
