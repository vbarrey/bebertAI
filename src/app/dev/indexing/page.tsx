"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "lucide-react";

import { Item, ItemContent, ItemMedia, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { IndexingStage, IndexingSteps } from "@/lib/queue/types";
import { JobStatus } from "@prisma/client";

const indexingSteps: {
  stage: IndexingStage,
  title: string;
  description: string;
}[] = [
    {
      stage: IndexingStage.CREATING,
      title: "Creating",
      description: "Preparing the indexing job.",
    },
    {
      stage: IndexingStage.EXTRACTING,
      title: "Extracting",
      description: "Extracting text from the document.",
    },
    {
      stage: IndexingStage.CHUNKING,
      title: "Chunking",
      description: "Splitting the document into smaller chunks.",
    },
    {
      stage: IndexingStage.PERSISTING_CHUNKS,
      title: "Persisting Chunks",
      description: "Saving the chunks to the database.",
    },
    {
      stage: IndexingStage.EMBEDDING,
      title: "Embedding",
      description: "Generating embeddings for the chunks.",
    },
    {
      stage: IndexingStage.PERSISTING_EMBEDDINGS,
      title: "Persisting Embeddings",
      description: "Saving the embeddings to the database.",
    },
    {
      stage: IndexingStage.COMPLETED,
      title: "Completed",
      description: "The indexing job has completed successfully.",
    }
  ];

export default function IndexingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [indexingStage, setIndexingStage] = useState<IndexingStage | null>(null);
  const [indexingJobFinished, setIndexingJobFinished] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const events = new EventSource(`/api/dev/indexing/${jobId}/events`);

    events.addEventListener("progress", (event) => {
      const progress = JSON.parse(event.data) as IndexingSteps;

      setIndexingStage(progress.stage);
    });

    events.addEventListener("status", (event) => {
      const data = JSON.parse(event.data) as {
        status: JobStatus;
      };

      switch (data.status) {
        case "COMPLETED":
          setIndexingStage(IndexingStage.COMPLETED);
          setLoading(false);
          setIndexingJobFinished(true);
          events.close();
          break;

        case "FAILED":
          setError("Indexing failed");
          setLoading(false);
          events.close();
          break;

        case "CANCELLED":
          setLoading(false);
          events.close();
          break;
      }
    });

    events.addEventListener("completed", () => {
      setIndexingStage(IndexingStage.COMPLETED);
      setLoading(false);
      setIndexingJobFinished(true);
      events.close();
    });

    events.addEventListener("failed", (event) => {
      const data = JSON.parse(event.data) as {
        errorMessage?: string;
      };

      setError(data.errorMessage ?? "Indexing failed");
      setLoading(false);
      events.close();
    });

    events.onerror = () => {
      events.close();
    };

    return () => {
      events.close();
    };
  }, [jobId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      return;
    }

    setLoading(true);
    setIndexingJobFinished(false);
    setError(null);
    setJobId(null);
    setIndexingStage(IndexingStage.CREATING);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/dev/indexing", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Indexing failed");
      }

      setJobId(data.jobId);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setJobId(null);
    setIndexingStage(null);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Indexing playground
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Test document indexing and its progress.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-b pb-6"
      >
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
        />

        <button
          type="submit"
          disabled={!file || loading}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? "Indexation..." : "Indexer"}
        </button>
      </form>

      {indexingStage && (
        <div className="mt-10 flex justify-center">
          <IndexingTimeline stage={indexingStage} indexingJobFinished={indexingJobFinished} />
        </div>
      )}

      {error && (
        <div className="mx-auto mt-8 max-w-xl rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </main>
  );
}

function IndexingTimeline({ stage, indexingJobFinished }: { stage: IndexingStage, indexingJobFinished: boolean }) {
  const currentIndex: number = indexingSteps.findIndex((step) => step.stage === stage);

  return (
    <div className="flex w-full max-w-xl flex-col">
      {indexingSteps.map((step, index) => {
        const isCompleted = index < currentIndex || indexingJobFinished;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={index + step.title}>
            <Item
              className={cn(
                "transition-colors",
                isPending && "text-muted-foreground/40",
                isCurrent && "text-foreground",
                isCompleted && "text-green-600 dark:text-green-500"
              )}
            >
              <ItemMedia variant="icon">
                {isCompleted ? (
                  <CheckIcon className="size-6" />
                ) : isCurrent ? (
                  <Spinner className="size-6" />
                ) : (
                  <div className="size-4 rounded-full bg-current opacity-40" />
                )}
              </ItemMedia>

              <ItemContent>
                <ItemTitle className="text-base">{step.title}</ItemTitle>
                <ItemDescription className="text-sm">{step.description}</ItemDescription>
              </ItemContent>
            </Item>

            {index < indexingSteps.length - 1 && (
              <div className="ml-5 h-8 border-l border-dashed border-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
