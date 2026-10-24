"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [{ href: "/settings/provider", label: "Fournisseurs et modèles d'IA" }];

// The pipeline is shared until each user has their own.
const ADMIN_LINKS = [
  { href: "/settings/pipeline", label: "Pipeline" },
  { href: "/settings/utilisateurs", label: "Utilisateurs" },
];

export function SettingsNav({ className, isAdmin }: { className?: string; isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-1", className)}>
      {(isAdmin ? [...LINKS, ...ADMIN_LINKS] : LINKS).map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
          className={cn(
            "flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
            pathname.startsWith(href) && "bg-accent",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
