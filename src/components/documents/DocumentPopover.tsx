"use client";

import { useState } from "react";
import {
    HardDrive,
    Plus,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

import { LocalDocumentImportDialog } from "./LocalDocumentImportDialog";
import { Document } from "@prisma/client";

type Props = {
    addDocuments: (documents: Document[]) => void;
    onIndexingStarted: (jobId: string) => void;
}

export function DocumentImportPopover({ addDocuments, onIndexingStarted }: Props) {
    const [popoverOpen, setPopoverOpen] =
        useState(false);

    const [localImportOpen, setLocalImportOpen] =
        useState(false);

    return (
        <>
            <Popover
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
            >
                <PopoverTrigger asChild>
                    <Button>
                        <Plus className="mr-2 size-4" />
                        Ajouter / Importer
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
                            // Google Drive plus tard.
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
                </PopoverContent>
            </Popover>

            <LocalDocumentImportDialog
                open={localImportOpen}
                onOpenChange={setLocalImportOpen}
                addDocuments={addDocuments}
                onIndexingStarted={onIndexingStarted}
            />
        </>
    );
}