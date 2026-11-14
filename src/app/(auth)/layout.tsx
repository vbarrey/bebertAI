import Image from "next/image";
import Link from "next/link";

// The pages reached without a session: sign-in, password reset, invitation, privacy; also the welcome page after the first sign-in.
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Image src="/logo.png" alt="" width={24} height={24} className="size-6" />
        Bebert AI
      </div>
      {children}
      <Link href="/confidentialite" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
        Règles de confidentialité
      </Link>
    </main>
  );
}
