/**
 * timeAgo — formats a date as "5 min ago", "3 hours ago", "2 days ago"
 * WITHOUT the leading "about" that date-fns adds.
 */
import { formatDistanceToNow } from "date-fns";

export function timeAgo(date: string | Date): string {
  const raw = formatDistanceToNow(new Date(date), { addSuffix: true });
  return raw.replace(/^about /, "");
}
