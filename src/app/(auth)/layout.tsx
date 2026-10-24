import Image from "next/image";

// The pages reached without a session: sign-in, password reset, invitation.
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Image src="/logo.png" alt="" width={24} height={24} className="size-6" />
        Bebert AI
      </div>
      {children}
    </main>
  );
}
