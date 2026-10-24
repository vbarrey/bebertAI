"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Files, FolderOpen, FolderPlus, LogOut, Settings, SquarePen } from "lucide-react";

import { createConversation } from "@/lib/mutations/conversation";
import { createProject } from "@/lib/mutations/projects";
import type { SidebarTree } from "@/lib/queries/conversation";
import { groupByDate } from "@/lib/date-groups";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TruncatedText } from "@/components/ui/truncated-text";
import { ConversationMenu } from "@/components/conversations/ConversationMenu";
import { cn } from "@/lib/utils";

import { useSignOut } from "./useSignOut";
import { useThemeChoice } from "./useThemeChoice";

export type SidebarUser = { name: string; email: string; role?: string | null };

type SidebarNavProps = {
  tree: SidebarTree;
  user: SidebarUser;
  // Closes the mobile menu once a link or an action is chosen.
  onNavigate?: () => void;
};

type SidebarConversation = SidebarTree["conversations"][number];

const rowClassName = (active: boolean) =>
  cn("group relative flex min-w-0 items-center rounded-md transition-colors hover:bg-accent", active && "bg-accent");

/** The projects with their latest conversations, the conversations outside any project, and the app pages. */
export function SidebarNav({ tree, user, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const theme = useThemeChoice();
  const signOut = useSignOut();
  // Opened or closed by hand; otherwise a project is open when the page shown is in it.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const projects = tree.projects.map(({ id, name }) => ({ id, name }));

  function conversationItem(conversation: SidebarConversation, projectId: string | null) {
    const href = `/conversations/${conversation.id}`;

    return (
      <li key={conversation.id} className={rowClassName(pathname === href)}>
        <Link href={href} onClick={onNavigate} className="min-w-0 flex-1 py-1.5 pr-8 pl-2 text-sm">
          <TruncatedText>{conversation.title ?? "Nouvelle conversation"}</TruncatedText>
        </Link>

        <ConversationMenu
          conversation={conversation}
          projectId={projectId}
          projects={projects}
          className="absolute right-0.5 size-6 opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
        />
      </li>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 p-2">
        <form action={createConversation} onSubmit={onNavigate} className="min-w-0 flex-1">
          <Button className="w-full">
            <SquarePen />
            Nouvelle conversation
          </Button>
        </form>

        <form action={createProject} onSubmit={onNavigate}>
          <Button variant="outline" size="icon" aria-label="Nouveau projet" title="Nouveau projet">
            <FolderPlus />
          </Button>
        </form>
      </div>

      {/* Radix lays the viewport content out as a table that grows with its widest line: block keeps the
          rows to the sidebar width, so the long titles are truncated. */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
        <nav className="space-y-5 px-2 pb-4">
          <section>
            <h2 className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Projets</h2>

            {tree.projects.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">Aucun projet</p>}

            <ul className="space-y-0.5">
              {tree.projects.map((project) => {
                const href = `/projects/${project.id}`;
                const containsPage = pathname === href || project.conversations.some((c) => pathname === `/conversations/${c.id}`);
                const open = toggled[project.id] ?? containsPage;

                return (
                  <li key={project.id}>
                    <div className={rowClassName(pathname === href)}>
                      <button
                        type="button"
                        onClick={() => setToggled((state) => ({ ...state, [project.id]: !open }))}
                        aria-expanded={open}
                        aria-label={open ? `Replier « ${project.name} »` : `Déplier « ${project.name} »`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                      </button>

                      <Link href={href} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm">
                        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                        <TruncatedText className="font-medium">{project.name}</TruncatedText>
                        <span className="ml-auto text-xs text-muted-foreground">{project._count.conversations}</span>
                      </Link>
                    </div>

                    {open && (
                      <ul className="mt-0.5 ml-[13px] space-y-0.5 border-l pl-2">
                        {project.conversations.length === 0 && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">Aucune conversation</li>
                        )}

                        {project.conversations.map((conversation) => conversationItem(conversation, project.id))}

                        {project._count.conversations > project.conversations.length && (
                          <li>
                            <Link href={href} onClick={onNavigate} className="block px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                              Voir les {project._count.conversations} conversations
                            </Link>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Conversations</h2>

            {tree.conversations.length === 0 && (
              <p className="px-2 py-1 text-sm text-muted-foreground">Aucune conversation hors projet</p>
            )}

            {groupByDate(tree.conversations, (conversation) => conversation.lastMessageAt).map((group) => (
              <div key={group.label} className="mb-3">
                <h3 className="px-2 py-1 text-xs text-muted-foreground">{group.label}</h3>
                <ul className="space-y-0.5">
                  {group.items.map((conversation) => conversationItem(conversation, null))}
                </ul>
              </div>
            ))}
          </section>
        </nav>
      </ScrollArea>

      <div className="space-y-0.5 border-t p-2">
        <Link href="/documents" onClick={onNavigate} className={cn(rowClassName(pathname.startsWith("/documents")), "gap-2 px-2 py-1.5 text-sm")}>
          <Files className="size-4 shrink-0" />
          Documents
        </Link>

        <Link href="/settings" onClick={onNavigate} className={cn(rowClassName(pathname.startsWith("/settings")), "gap-2 px-2 py-1.5 text-sm")}>
          <Settings className="size-4 shrink-0" />
          Réglages
        </Link>

        <button type="button" onClick={theme.cycle} className={cn(rowClassName(false), "w-full gap-2 px-2 py-1.5 text-sm")}>
          <theme.Icon className="size-4 shrink-0" />
          {theme.label}
        </button>

        <div className="flex items-center gap-2 border-t pt-2 pl-2">
          <div className="min-w-0 flex-1">
            <TruncatedText className="text-sm font-medium">{user.name}</TruncatedText>
            <TruncatedText className="text-xs text-muted-foreground">{user.email}</TruncatedText>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
