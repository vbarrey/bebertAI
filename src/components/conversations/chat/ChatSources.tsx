"use client";

import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import type { ChatSource } from "@/lib/ai/types";

const MAX_NAME_LENGTH = 28;

type ChatSourcesProps = {
  sources: ChatSource[];
};

function shortName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH).trimEnd()}…` : name;
}

/**
 * One badge per excerpt given to the model, numbered like the "Extrait N" the answer may cite.
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
          <Badge variant="outline" asChild>
            {/* The file itself for now; the chunk bounding box once a document viewer exists. */}
            <a
              href={`/api/documents/${source.documentId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={source.pageNumber ? `${source.documentName}, page ${source.pageNumber}` : source.documentName}
            >
              {index + 1} · {shortName(source.documentName)}
            </a>
          </Badge>
        </li>
      ))}
    </motion.ul>
  );
}
