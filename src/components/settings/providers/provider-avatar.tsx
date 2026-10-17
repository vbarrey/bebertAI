"use client";

import { Blobatar } from "@blobatar/react";

type ProviderAvatarProps = {
  // The id, not the name: unique, and the avatar stays when the provider is renamed.
  providerId: string;
  size?: number;
  className?: string;
};

// The same id always draws the same blobatar: nothing to store to show it anywhere in the app.
export function ProviderAvatar({ providerId, size = 36, className }: ProviderAvatarProps) {
  return <Blobatar name={providerId} size={size} background="squircle" alt="" className={className} />;
}
