// Backups kept by scripts/backup.ts: the latest ones, and the latest Sunday ones for a longer reach.
const KEEP_LATEST = 4;
const KEEP_SUNDAYS = 2;

/** The backups to delete among the backup directories (named YYYY-MM-DD; any other name is left alone). */
export function backupsToDelete(names: string[]): string[] {
  const backups = names.filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort().reverse();
  const sundays = backups.filter((name) => new Date(`${name}T12:00:00Z`).getUTCDay() === 0);
  const kept = new Set([...backups.slice(0, KEEP_LATEST), ...sundays.slice(0, KEEP_SUNDAYS)]);

  return backups.filter((name) => !kept.has(name));
}
