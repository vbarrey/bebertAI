import { UsersSettings } from "@/components/settings/users/UsersSettings";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export default async function UsersSettingsPage() {
  const admin = await requireAdmin();

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true },
    }),
    prisma.invitation.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);

  return <UsersSettings currentUserId={admin.id} users={users} invitations={invitations} />;
}
