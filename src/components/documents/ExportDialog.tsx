"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listBundleJobs, previewExport, startExport, type BundleJobView, type ExportPreview } from "@/lib/mutations/bundle";
import type { ExportParameters } from "@/lib/bundle/selection";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projects: { id: string; name: string }[];
    // Picked on the documents page: the export holds them, without choice of scope.
    documentIds: string[] | null;
};

type Files = ExportParameters["files"];

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

const STATUS_LABELS: Record<string, string> = {
    QUEUED: "En attente",
    RUNNING: "En cours",
    COMPLETED: "Terminé",
    FAILED: "Échec",
    CANCELLED: "Annulé",
};

/** Exports indexed documents with their vectors into a .bebert file, to import them elsewhere. */
export function ExportDialog({ open, onOpenChange, projects, documentIds }: Props) {
    // "library", "all" or a project id.
    const [scope, setScope] = useState("library");
    const [files, setFiles] = useState<Files>("local");
    const [preview, setPreview] = useState<ExportPreview | null>(null);
    const [jobs, setJobs] = useState<BundleJobView[]>([]);
    const [starting, setStarting] = useState(false);

    const selection: ExportParameters["selection"] = documentIds ? { kind: "documents", documentIds }
        : scope === "library" || scope === "all" ? { kind: scope }
        : { kind: "project", projectId: scope };
    const selectionKey = JSON.stringify(selection);

    useEffect(() => {
        if (!open) return;
        let current = true;
        previewExport({ selection: JSON.parse(selectionKey), files: "local" })
            .then((result) => { if (current) setPreview("error" in result ? null : result); })
            .catch(() => { if (current) setPreview(null); });
        return () => { current = false; };
    }, [open, selectionKey]);

    const running = jobs.some((job) => job.kind === "EXPORT" && (job.status === "QUEUED" || job.status === "RUNNING"));

    // Every 2 s while an export runs, once when the dialog opens.
    useEffect(() => {
        if (!open) return;
        let current = true;
        const refresh = () => listBundleJobs().then((list) => { if (current) setJobs(list.filter((job) => job.kind === "EXPORT")); }).catch(() => undefined);
        void refresh();
        const timer = running ? setInterval(refresh, 2000) : undefined;
        return () => { current = false; clearInterval(timer); };
    }, [open, running]);

    async function handleExport() {
        setStarting(true);
        try {
            const result = await startExport({ selection, files });
            if ("error" in result) {
                toast.error(result.error);
                return;
            }
            setJobs((await listBundleJobs()).filter((job) => job.kind === "EXPORT"));
        } catch {
            toast.error("Impossible de lancer l'export.");
        } finally {
            setStarting(false);
        }
    }

    const size = preview ? preview.localBytes + (files === "local+drive" ? preview.driveBytes : 0) : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Exporter des documents</DialogTitle>
                    <DialogDescription>
                        Un fichier .bebert avec les documents indexés, leur texte découpé et leurs vecteurs : importé ailleurs, il
                        n&apos;a pas à être réindexé.
                    </DialogDescription>
                </DialogHeader>

                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="export-scope">Documents</FieldLabel>
                        {documentIds ? (
                            <p id="export-scope" className="text-sm">{documentIds.length} document(s) sélectionné(s)</p>
                        ) : (
                            <Select value={scope} onValueChange={(value) => setScope(value as string)}>
                                <SelectTrigger id="export-scope" className="w-full">
                                    <SelectValue>
                                        {scope === "library" ? "Bibliothèque" : scope === "all" ? "Tous les documents, ceux des projets compris"
                                            : `Projet « ${projects.find((project) => project.id === scope)?.name} »`}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="library">Bibliothèque</SelectItem>
                                    {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.id}>Projet « {project.name} »</SelectItem>
                                    ))}
                                    <SelectItem value="all">Tous les documents, ceux des projets compris</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                        {preview && (
                            <FieldDescription>
                                {preview.exported} document(s) indexé(s) exporté(s)
                                {preview.skipped > 0 && `, ${preview.skipped} non indexé(s) laissé(s) de côté`}.
                            </FieldDescription>
                        )}
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="export-files">Inclure les fichiers</FieldLabel>
                        <Select value={files} onValueChange={(value) => setFiles(value as Files)}>
                            <SelectTrigger id="export-files" className="w-full">
                                <SelectValue>{files === "local" ? "Fichiers locaux" : "Fichiers locaux et Google Drive"}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="local">Fichiers locaux</SelectItem>
                                <SelectItem value="local+drive">Fichiers locaux et Google Drive</SelectItem>
                            </SelectContent>
                        </Select>
                        <FieldDescription>
                            {files === "local"
                                ? "Les documents Google Drive gardent leur lien : ils s'ouvrent avec le même compte Google."
                                : "Les fichiers Google Drive sont copiés dans l'export : ils s'ouvrent sans le compte Google."}
                            {preview && ` Environ ${megabytes(size)} de fichiers, plus le texte et les vecteurs.`}
                        </FieldDescription>
                    </Field>
                </FieldGroup>

                {jobs.length > 0 && (
                    <section className="space-y-3">
                        <h3 className="text-sm font-medium">Exports récents</h3>
                        <ul className="space-y-3">
                            {jobs.map((job) => <ExportJobItem key={job.id} job={job} />)}
                        </ul>
                    </section>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
                    <Button onClick={handleExport} disabled={starting || !preview || preview.exported === 0}>
                        {starting ? "Lancement..." : "Exporter"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ExportJobItem({ job }: { job: BundleJobView }) {
    const result = job.result as { documents?: number; chunks?: number; driveDownloadFailures?: string[] } | null;
    const failures = result?.driveDownloadFailures ?? [];

    return (
        <li className="space-y-1 rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium" title={job.label}>{job.label}</span>
                {job.downloadable ? (
                    <Button asChild size="sm" variant="outline" className="gap-2">
                        <a href={`/api/bundles/${job.id}`} download>
                            <Download className="size-4" />
                            {megabytes(job.fileSize ?? 0)}
                        </a>
                    </Button>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {job.status === "COMPLETED" ? "Expiré" : STATUS_LABELS[job.status] ?? job.status}
                    </span>
                )}
            </div>
            {(job.status === "QUEUED" || job.status === "RUNNING") && <Progress value={job.progress} aria-label="Avancement de l'export" />}
            <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(job.createdAt, { addSuffix: true, locale: fr })}
                {result?.documents !== undefined && ` · ${result.documents} document(s), ${result.chunks} chunk(s)`}
                {job.status === "COMPLETED" && job.downloadable && " · disponible 24 h"}
            </p>
            {failures.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                    {failures.length} fichier(s) Google Drive non téléchargé(s), exporté(s) avec leur lien seul.
                </p>
            )}
            {job.errorMessage && <p className="text-xs text-destructive">{job.errorMessage}</p>}
        </li>
    );
}
