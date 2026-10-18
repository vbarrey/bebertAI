import { differenceInCalendarDays } from "date-fns";

const GROUPS = [
  { label: "Aujourd'hui", maxDays: 0 },
  { label: "Hier", maxDays: 1 },
  { label: "7 derniers jours", maxDays: 6 },
  { label: "30 derniers jours", maxDays: 29 },
  { label: "Plus ancien", maxDays: Infinity },
];

/** The items by the day of their date, most recent group first; the empty groups are left out. */
export function groupByDate<T>(items: T[], date: (item: T) => Date, now = new Date()): { label: string; items: T[] }[] {
  const groups = GROUPS.map((group) => ({ ...group, items: [] as T[] }));

  for (const item of items) {
    const days = differenceInCalendarDays(now, date(item));
    groups.find((group) => days <= group.maxDays)?.items.push(item);
  }

  return groups.filter((group) => group.items.length > 0).map(({ label, items }) => ({ label, items }));
}
