"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

const THEMES = {
  system: { label: "Thème du système", Icon: Monitor, next: "light" },
  light: { label: "Thème clair", Icon: Sun, next: "dark" },
  dark: { label: "Thème sombre", Icon: Moon, next: "system" },
} as const;

type ThemeName = keyof typeof THEMES;

const noSubscription = () => () => {};

/**
 * The chosen theme and the action that moves to the next one: système → clair → sombre.
 * The theme is only known in the browser: the server render shows "système" until hydration.
 */
export function useThemeChoice() {
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);

  const current: ThemeName = hydrated && theme && theme in THEMES ? (theme as ThemeName) : "system";
  const { label, Icon, next } = THEMES[current];

  return { label, Icon, cycle: () => setTheme(next) };
}
