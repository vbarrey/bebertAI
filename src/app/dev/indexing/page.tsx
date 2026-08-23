"use client";

import { useState } from "react";

import { IndexingResult } from "@/lib/rag/indexing/types";

export default function IndexingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<IndexingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

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

      console.log(data);

      setResult(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Indexing playground
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Test document extraction and chunking.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-b pb-6"
      >
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
        />

        <button
          type="submit"
          disabled={!file || loading}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? "Processing..." : "Process"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-10">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {result.fileName}
            </span>{" "}
            · {result.extraction.blocks.length} blocks · {result.chunks.length}{" "}
            chunks
          </div>

          <section>
            <h2 className="mb-4 text-sm font-medium">Extracted blocks</h2>

            <div className="divide-y rounded-lg border">
              {result.extraction.blocks.map((block, index) => (
                <div key={index} className="p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Block {index}</span>

                    {block.pageNumber !== undefined && (
                      <span>Page {block.pageNumber}</span>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {block.text}
                  </p>

                  {block.bounds && (
                    <div className="mt-3 font-mono text-xs text-muted-foreground">
                      x: {block.bounds.x.toFixed(1)} · y:{" "}
                      {block.bounds.y.toFixed(1)} · w:{" "}
                      {block.bounds.width.toFixed(1)} · h:{" "}
                      {block.bounds.height.toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-medium">Indexed chunks</h2>

            <div className="divide-y rounded-lg border">
              {result.chunks.map((chunk) => (
                <div key={chunk.position} className="p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Chunk {chunk.position}</span>

                    {chunk.pageNumber !== undefined && (
                      <span>Page {chunk.pageNumber}</span>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {chunk.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
