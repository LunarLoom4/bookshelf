/**
 * timeAgo -- compact relative time string.
 * "just now", "2m", "3h", "5d", "2mo", "1y"
 */
export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 45)  return "just now";
  if (seconds < 90)  return "1m";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)  return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24)    return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30)     return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12)   return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}
