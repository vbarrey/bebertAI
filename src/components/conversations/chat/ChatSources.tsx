"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Markdown } from "@/components/ui/markdown";
import { citedSource, linkCitations } from "@/lib/ai/chat/citations";
import type { ChatSource } from "@/lib/ai/types";

const MAX_NAME_LENGTH = 28;

function shortName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH).trimEnd()}…` : name;
}

// The file itself for now; the chunk bounding box once a document viewer exists.
function sourceHref(source: ChatSource): string {
  return `/api/documents/${source.documentId}`;
}

/** The source on hover: the document, the excerpt number and page, the start of the excerpt. */
function SourceHoverCard({ source, number, children }: { source: ChatSource; number: number; children: ReactNode }) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>

      <HoverCardContent align="start" className="w-80 space-y-2">
        <p className="flex items-start gap-2 font-medium">
          <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="break-words">{source.documentName}</span>
        </p>

        <p className="text-muted-foreground">
          Extrait {number}{source.pageNumber ? ` · page ${source.pageNumber}` : ""}
        </p>

        {source.preview && (
          <p className="line-clamp-6 border-l-2 pl-2 text-foreground/80">{source.preview}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * The answer, its citations of sources ("[2]", "Extrait 3") linked to them: a numbered mark, or the cited words,
 * that opens the document and shows the excerpt on hover.
 */
export function AnswerMarkdown({ content, sources = [] }: { content: string; sources?: ChatSource[] }) {
  return (
    <Markdown
      content={linkCitations(content, sources.length)}
      components={{
        a: ({ href, children }) => {
          const number = citedSource(href);
          const source = number ? sources[number - 1] : undefined;

          if (!number || !source) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4 hover:text-primary">
                {children}
              </a>
            );
          }

          const isMark = String(children) === String(number);

          return (
            <SourceHoverCard source={source} number={number}>
              <a
                href={sourceHref(source)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Source ${number} : ${source.documentName}`}
                className={isMark
                  ? "mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 align-super text-[0.65rem] font-medium text-muted-foreground no-underline transition-colors hover:bg-primary hover:text-primary-foreground"
                  : "underline decoration-dotted underline-offset-4 hover:text-primary"}
              >
                {children}
              </a>
            </SourceHoverCard>
          );
        },
      }}
    />
  );
}

type ChatSourcesProps = {
  sources: ChatSource[];
};

/**
 * One badge per excerpt given to the model, numbered like the "[n]" and "Extrait n" the answer cites.
 */
export function ChatSources({ sources }: ChatSourcesProps) {
  return (
    <motion.ul
      aria-label="Sources"
      className="mt-3 flex flex-wrap gap-1.5"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {sources.map((source, index) => (
        <li key={source.chunkId}>
          <SourceHoverCard source={source} number={index + 1}>
            <Badge variant="outline" asChild>
              <a href={sourceHref(source)} target="_blank" rel="noopener noreferrer">
                {index + 1} · {shortName(source.documentName)}
              </a>
            </Badge>
          </SourceHoverCard>
        </li>
      ))}
    </motion.ul>
  );
}
