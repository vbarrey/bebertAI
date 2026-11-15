"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { listBundleJobs, type BundleJobView } from "@/lib/mutations/bundle";
import type { ImportResult } from "@/lib/bundle/import";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const STATUS_LABELS: Record<string, string> = {
    QUEUED: "En attente",
    RUNNING: "En cours",
    COMPLETED: "Terminé",
    FAILED: "Échec",
};

/** Sends the file with its upload progress: fetch cannot tell it. */
function upload(file: File, onProgress: (percent: number) => void): Promise<{ jobId?: string; error?: string }> {
    return new Promise((resolve) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/bundles/import");
        request.setRequestHeader("Content-Type", "application/octet-stream");
        request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
        request.upload.onprogress = (event) => onProgress(Math.round((event.loaded / event.total) * 100));
        request.onload = () => {
            try {
                resolve(JSON.parse(request.responseText));
            } catch {
                resolve({ error: `Envoi refusé (${request.status}).` });
            }
        };
        request.onerror = () => resolve({ error: "Envoi interrompu : vérifiez la connexion et réessayez." });
        request.send(file);
    });
}

/** Imports a .bebert file exported from BebertAI: its documents join the library, already indexed. */
export function BundleImportDialog({ open, onOpenChange }: Props) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    // Changed once a file is sent: the input starts empty again.
    const [inputKey, setInputKey] = useState(0);
    const [uploading, setUploading] = useState<number | null>(null);
    const [jobs, setJobs] = useState<BundleJobView[]>([]);

    const running = jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");

    // Every 2 s while an import runs.
    useEffect(() => {
        if (!open) return;
        let current = true;
        const refresh = () => listBundleJobs()
            .then((list) => { if (current) setJobs(list.filter((job) => job.kind === "IMPORT")); })
            .catch(() => undefined);
        void refresh();
        const timer = running ? setInterval(refresh, 2000) : undefined;
        return () => { current = false; clearInterval(timer); };
    }, [open, running]);

    // An import just ended: the documents page shows its documents.
    const wasRunning = useRef(false);
    useEffect(() => {
        if (wasRunning.current && !running) router.refresh();
        wasRunning.current = running;
    }, [running, router]);

    async function handleImport() {
        if (!file) return;
        setUploading(0);
        try {
            const result = await upload(file, setUploading);
            if (result.error || !result.jobId) {
                toast.error(result.error ?? "Envoi refusé.");
                return;
            }
            setFile(null);
            setInputKey((key) => key + 1);
            setJobs((await listBundleJobs()).filter((job) => job.kind === "IMPORT"));
        } finally {
            setUploading(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Importer un export BebertAI</DialogTitle>
                    <DialogDescription>
                        Les documents d&apos;un fichier .bebert rejoignent votre bibliothèque déjà indexés, sans passer par
                        l&apos;extraction ni l&apos;embedding. Ceux que vous avez déjà sont ignorés.
                    </DialogDescription>
                </DialogHeader>

                <Field>
                    <FieldLabel htmlFor="bundle-file">Fichier .bebert</FieldLabel>
                    <Input
                        key={inputKey}
                        id="bundle-file"
                        type="file"
                        accept=".bebert"
                        disabled={uploading !== null}
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    <FieldDescription>
                        Votre modèle d&apos;embedding (Réglages &gt; Pipeline) doit être celui de l&apos;export, ou un
                        équivalent : c&apos;est vérifié avant d&apos;importer quoi que ce soit.
                    </FieldDescription>
                </Field>

                {uploading !== null && <Progress value={uploading} aria-label="Envoi du fichier" />}

                {jobs.length > 0 && (
                    <section className="space-y-3">
                        <h3 className="text-sm font-medium">Imports récents</h3>
                        <ul className="space-y-3">
                            {jobs.map((job) => <ImportJobItem key={job.id} job={job} />)}
                        </ul>
                    </section>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
                    <Button onClick={handleImport} disabled={!file || uploading !== null}>
                        {uploading !== null ? `Envoi... ${uploading} %` : "Importer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ImportJobItem({ job }: { job: BundleJobView }) {
    const result = job.result as ImportResult | null;
    const missingAccounts = result?.driveAccounts.filter(({ connected }) => !connected) ?? [];

    return (
        <li className="space-y-1 rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium" title={job.label}>{job.label}</span>
                <span className="text-xs text-muted-foreground">{STATUS_LABELS[job.status] ?? job.status}</span>
            </div>
            {(job.status === "QUEUED" || job.status === "RUNNING") && <Progress value={job.progress} aria-label="Avancement de l'import" />}
            <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(job.createdAt, { addSuffix: true, locale: fr })}
                {result && ` · ${result.imported} importé(s), ${result.skipped} déjà présent(s)`}
            </p>
            {result?.failed.map(({ name, error }) => (
                <p key={name} className="text-xs text-destructive">{name} : {error}</p>
            ))}
            {result?.warnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-600 dark:text-amber-500">{warning}</p>
            ))}
            {missingAccounts.map(({ email, documents }) => (
                <p key={email} className="text-xs text-amber-600 dark:text-amber-500">
                    {documents} document(s) Google Drive de {email} : connectez ce compte Google pour les ouvrir et les
                    réindexer. La recherche fonctionne déjà.
                </p>
            ))}
            {job.errorMessage && <p className="text-xs text-destructive">{job.errorMessage}</p>}
        </li>
    );
}
