"use client";

import { useEffect, useState } from "react";
import {
    HardDrive,
    PackageOpen,
    Plus,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import { LocalDocumentImportDialog } from "./LocalDocumentImportDialog";
import { GoogleDriveImportDialog } from "./GoogleDriveImportDialog";
import { BundleImportDialog } from "./BundleImportDialog";
import { Document } from "@prisma/client";

type Props = {
    addDocuments: (documents: Document[]) => void;
    onIndexingStarted: (jobId: string) => void;
    // Back from the Google consent screen: "connected" reopens the Drive import.
    googleDriveResult?: string;
    // Imported for this project only.
    projectId?: string;
}

export function DocumentImportPopover({ addDocuments, onIndexingStarted, googleDriveResult, projectId }: Props) {
    const [popoverOpen, setPopoverOpen] =
        useState(false);

    const [localImportOpen, setLocalImportOpen] =
        useState(false);

    const [bundleImportOpen, setBundleImportOpen] =
        useState(false);

    const [driveImportOpen, setDriveImportOpen] =
        useState(googleDriveResult === "connected");

    const router = useRouter();
    const pathname = usePathname();

    // The result is shown once: dropped from the URL through the router (history.replaceState
    // alone is undone by Next.js), so a reload does not show it again.
    useEffect(() => {
        if (!googleDriveResult) {
            return;
        }

        router.replace(pathname, { scroll: false });

        if (googleDriveResult !== "connected") {
            // The id keeps a single toast when the effect runs twice in development.
            toast.error(
                googleDriveResult === "no-drive-access"
                    ? "Connexion refusée : l'accès à vos fichiers Google Drive n'a pas été autorisé. Reconnectez-vous en cochant l'accès à vos fichiers sur l'écran de Google."
                    : "La connexion à Google Drive a échoué.",
                { id: "google-drive-connection", duration: 10_000 },
            );
        }
    }, [googleDriveResult, pathname, router]);

    return (
        <>
            <Popover
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
            >
                <PopoverTrigger asChild>
                    <Button>
                        <Plus data-icon="inline-start" />
                        {projectId ? "Importer dans le projet" : "Ajouter / Importer"}
                    </Button>
                </PopoverTrigger>

                <PopoverContent
                    align="end"
                    className="w-64 p-2"
                >
                    <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                            setPopoverOpen(false);
                            setLocalImportOpen(true);
                        }}
                    >
                        <HardDrive className="mr-2 size-4" />
                        Depuis cet appareil
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                            setPopoverOpen(false);
                            setDriveImportOpen(true);
                        }}
                    >
                        <Image
                            src="/icons/google-drive.svg"
                            alt=""
                            className="size-4 mr-2"
                            width={20}
                            height={20}
                        />
                        Google Drive
                    </Button>

                    {/* Into the library, whatever the page: not offered from a project. */}
                    {!projectId && (
                        <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                                setPopoverOpen(false);
                                setBundleImportOpen(true);
                            }}
                        >
                            <PackageOpen className="mr-2 size-4" />
                            Export BebertAI (.bebert)
                        </Button>
                    )}
                </PopoverContent>
            </Popover>

            <LocalDocumentImportDialog
                open={localImportOpen}
                onOpenChange={setLocalImportOpen}
                addDocuments={addDocuments}
                onIndexingStarted={onIndexingStarted}
                projectId={projectId}
            />

            <BundleImportDialog open={bundleImportOpen} onOpenChange={setBundleImportOpen} />

            <GoogleDriveImportDialog
                open={driveImportOpen}
                onOpenChange={setDriveImportOpen}
                addDocuments={addDocuments}
                onIndexingStarted={onIndexingStarted}
                projectId={projectId}
            />
        </>
    );
}