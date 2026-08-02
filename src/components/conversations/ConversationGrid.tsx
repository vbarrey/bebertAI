import { Conversation } from "@prisma/client";

import { ConversationCard } from "./ConversationCard";

type ConversationGridProps = {
  conversations: Conversation[];
};

export function ConversationGrid({ conversations }: ConversationGridProps) {
    if(conversations.length === 0) {
        return (
            <div className="flex justify-center items-center h-full w-full mt-4 mb-4">
                <p className="text-muted-foreground">Aucune conversation pour le moment</p>
            </div>
        );
    }else if(conversations.length ==  1) {
        return (
            <section className="flex justify-center items-center h-full w-full mt-4 mb-4">
                <ConversationCard
                    conversation={conversations[0]}
                />
            </section>
        );  
    } else {
        return (
            <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 w-full mt-4 mb-4">
                {conversations.map((conversation) => (
                    <ConversationCard
                        key={conversation.id}
                        conversation={conversation}
                    />
                ))}
            </section>
        );
    }
}