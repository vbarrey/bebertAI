import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { UnrecoverableError } from "bullmq";

import type { ExtractedBlock } from "../types";

const execFileAsync = promisify(execFile);

// Tesseract is tuned for ~300 DPI scans.
const RENDER_DPI = 300;
const PDF_POINTS_PER_INCH = 72;
const COMMAND_TIMEOUT_MS = 120_000;

/**
 * Runs a system binary without a shell: arguments are passed as-is, never interpreted.
 */
async function run(
    command: string,
    args: string[],
): Promise<string> {
    try {
        const { stdout } = await execFileAsync(command, args, {
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: 64 * 1024 * 1024,
            windowsHide: true,
        });

        return stdout;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            // Retrying cannot help until the binary is installed.
            throw new UnrecoverableError(
                `« ${command} » est introuvable. Installez Tesseract et Poppler (voir README, section OCR).`,
            );
        }

        const stderr = (error as { stderr?: string }).stderr?.trim();

        throw new Error(
            `${command} a échoué${stderr ? ` : ${stderr}` : ""}`,
            { cause: error },
        );
    }
}

/**
 * Recognition languages installed for Tesseract ("osd" only detects orientation).
 */
export async function listInstalledOcrLanguages(): Promise<string[]> {
    const output = await run("tesseract", ["--list-langs"]);

    // First line is a header: "List of available languages in ...".
    return output
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter((language) => language && language !== "osd");
}

/**
 * Returns the Tesseract `-l` value for the requested languages that are installed.
 */
export async function getOcrLanguages(
    requested: readonly string[],
): Promise<string> {
    const installed = new Set(await listInstalledOcrLanguages());

    const available = requested.filter((language) => installed.has(language));
    const missing = requested.filter((language) => !installed.has(language));

    if (available.length === 0) {
        throw new UnrecoverableError(
            `Données linguistiques Tesseract manquantes (${requested.join(", ")}). Installez les fichiers .traineddata correspondants (voir README, section OCR).`,
        );
    }

    if (missing.length > 0) {
        console.warn(
            `[OCR] Données linguistiques Tesseract manquantes, ignorées : ${missing.join(", ")}`,
        );
    }

    return available.join("+");
}

/**
 * OCRs an image file. `scale` converts pixels to the unit of the returned bounds.
 */
export async function ocrImage(
    imagePath: string,
    languages: string,
    { dpi, scale = 1 }: { dpi?: number; scale?: number } = {},
): Promise<ExtractedBlock[]> {
    const tsv = await run("tesseract", [
        // Absolute path: a relative one starting with "-" would be read as an option.
        path.resolve(imagePath),
        "stdout",
        "-l",
        languages,
        ...(dpi ? ["--dpi", String(dpi)] : []),
        "tsv",
    ]);

    return mergeIntoPageBlock(parseTesseractTsv(tsv, scale));
}

/**
 * One block per page, like native extraction: Tesseract finds many tiny "paragraphs" (captions, numbers)
 * that would each become a useless chunk. Blank lines keep paragraph breaks for the chunker.
 */
export function mergeIntoPageBlock(
    blocks: ExtractedBlock[],
): ExtractedBlock[] {
    if (blocks.length === 0) {
        return [];
    }

    const boxes = blocks.flatMap((block) => (block.bounds ? [block.bounds] : []));
    const x = Math.min(...boxes.map((box) => box.x));
    const y = Math.min(...boxes.map((box) => box.y));

    return [{
        text: blocks.map((block) => block.text).join("\n\n"),
        bounds: boxes.length > 0
            ? {
                x,
                y,
                width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
                height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
            }
            : undefined,
    }];
}

/**
 * Renders one PDF page with Poppler then OCRs it. Bounds are in PDF points, like native extraction.
 */
export async function ocrPdfPage(
    pdfPath: string,
    pageNumber: number,
    languages: string,
): Promise<ExtractedBlock[]> {
    const directory = await mkdtemp(path.join(tmpdir(), "bebert-ocr-"));

    try {
        const prefix = path.join(directory, "page");

        await run("pdftoppm", [
            "-r", String(RENDER_DPI),
            "-f", String(pageNumber),
            "-l", String(pageNumber),
            "-singlefile",
            "-png",
            path.resolve(pdfPath),
            prefix,
        ]);

        return await ocrImage(`${prefix}.png`, languages, {
            dpi: RENDER_DPI,
            scale: PDF_POINTS_PER_INCH / RENDER_DPI,
        });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

type Paragraph = {
    lines: Map<number, string[]>;
    left: number;
    top: number;
    right: number;
    bottom: number;
};

/**
 * Turns Tesseract TSV output into one block per paragraph, in Tesseract's reading order.
 * Bounds use a bottom-left origin to match unpdf's PDF coordinates.
 */
export function parseTesseractTsv(
    tsv: string,
    scale = 1,
): ExtractedBlock[] {
    const paragraphs = new Map<string, Paragraph>();
    let pageHeight = 0;

    for (const row of tsv.split(/\r?\n/).slice(1)) {
        const columns = row.split("\t");

        if (columns.length < 12) {
            continue;
        }

        const [level, , block, paragraph, line, , left, top, width, height] =
            columns.slice(0, 10).map(Number);
        const text = columns.slice(11).join("\t").trim();

        if (level === 1) {
            pageHeight = height;
            continue;
        }

        if (level !== 5 || !text) {
            continue;
        }

        const key = `${block}:${paragraph}`;
        const current = paragraphs.get(key) ?? {
            lines: new Map(),
            left,
            top,
            right: left + width,
            bottom: top + height,
        };

        current.lines.set(line, [...(current.lines.get(line) ?? []), text]);
        current.left = Math.min(current.left, left);
        current.top = Math.min(current.top, top);
        current.right = Math.max(current.right, left + width);
        current.bottom = Math.max(current.bottom, top + height);

        paragraphs.set(key, current);
    }

    return [...paragraphs.values()].map((paragraph) => ({
        text: [...paragraph.lines.values()]
            .map((words) => words.join(" "))
            .join("\n"),
        bounds: {
            x: paragraph.left * scale,
            y: (pageHeight - paragraph.bottom) * scale,
            width: (paragraph.right - paragraph.left) * scale,
            height: (paragraph.bottom - paragraph.top) * scale,
        },
    }));
}
