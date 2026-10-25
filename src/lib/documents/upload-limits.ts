// Shared by the import dialog and the import routes, which read all the files of an import in memory at once:
// prudent limits for a small server.
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_UPLOAD_SIZE = 300 * 1024 * 1024;

const MB = 1024 * 1024;

/** Why these files cannot be sent in one import, null when they can. */
export function uploadLimitError(files: { name: string; size: number }[]): string | null {
  const tooLarge = files.filter((file) => file.size > MAX_FILE_SIZE).map((file) => file.name);

  if (tooLarge.length > 0) {
    return `Fichier trop volumineux (plus de ${MAX_FILE_SIZE / MB} Mo) : ${tooLarge.join(", ")}.`;
  }

  if (files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_SIZE) {
    return `Ces fichiers dépassent ${MAX_UPLOAD_SIZE / MB} Mo au total : importez-les en plusieurs fois.`;
  }

  return null;
}

/**
 * Before reading the body: a request announcing more than the limit (and the multipart overhead) is refused at once.
 */
export function uploadTooLarge(request: Request) {
  return Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_SIZE + MB;
}
