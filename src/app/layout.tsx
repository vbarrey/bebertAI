import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { initializeAI } from "@/lib/startup/initialize-ai";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Archivist BebertAI",
  description: "Assistant de recherche pour archives personnelles",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {

  await initializeAI();

  return (
    <html lang="fr" className={cn("font-sans", inter.variable)}>
      <body>{children}</body>
    </html>
  );
}
