"use client";

import type {
  DocumentImportAnalysis,
  DocumentImportConflictAction,
} from "@/types/document-import";

type Props = {
  analysis: DocumentImportAnalysis;
  decisions: Map<string, DocumentImportConflictAction>;
  importError: string | null;
};

/**
 * Review step of an import, whatever the source: the files to import with their conflict decision,
 * and the ignored ones.
 */
export function DocumentImportReview({
  analysis,
  decisions,
  importError,
}: Props) {
  return (
    <>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Vérification
        </p>

        <p className="text-sm text-muted-foreground">
          {analysis.files.length} fichier
          {analysis.files.length !==
            1
            ? "s"
            : ""}{" "}
          prêt
          {analysis.files.length !==
            1
            ? "s"
            : ""}{" "}
          à être importé
          {analysis.files.length !==
            1
            ? "s"
            : ""}
          .
        </p>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {analysis.files.map(
          (file) => {
            const decision =
              decisions.get(
                file.key,
              );

            return (
              <div
                key={file.key}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {file.displayName}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {file.format} ·{" "}
                    {(
                      file.fileSize /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>

                <div className="ml-4 shrink-0">
                  {decision ===
                    "IGNORE" ? (
                    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      Ignorer
                    </span>
                  ) : decision ===
                    "REPLACE" ? (
                    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-foreground">
                      Remplacer
                    </span>
                  ) : file.conflict ? (
                    <span className="text-xs text-destructive">
                      Existe déjà
                    </span>
                  ) : null}
                </div>
              </div>
            );
          },
        )}
      </div>

      {analysis.ignored.length >
        0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {analysis.ignored.length}{" "}
              fichier
              {analysis.ignored.length !==
                1
                ? "s"
                : ""}{" "}
              ignoré
              {analysis.ignored.length !==
                1
                ? "s"
                : ""}
            </p>

            <div className="max-h-32 space-y-1 overflow-y-auto">
              {analysis.ignored.map(
                (file) => (
                  <div
                    key={file.key}
                    className="rounded-md border px-3 py-2"
                  >
                    <p className="text-sm">
                      {file.displayName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {file.reason ===
                        "UNSUPPORTED_FORMAT"
                        ? "Format non supporté"
                        : "Doublon"}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

      {importError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {importError}
        </div>
      )}
    </>
  );
}
