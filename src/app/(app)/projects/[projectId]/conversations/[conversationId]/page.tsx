import { redirect } from "next/navigation";

type LegacyConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

// A conversation has a single address, in a project or not: /conversations/[id].
export default async function LegacyConversationPage({ params }: LegacyConversationPageProps) {
  const { conversationId } = await params;
  redirect(`/conversations/${conversationId}`);
}
