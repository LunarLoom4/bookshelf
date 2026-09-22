/**
 * timeAgo -- relative time string.
 *
 * compact (default): "just now", "2m", "3h", "5d", "2mo", "1y"
 * verbose: "just now", "2 minutes ago", "3 hours ago", "5 days ago", "2 months ago", "1 year ago"
 */
export function timeAgo(date: string | Date, verbose = false): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 45) return "just now";

  if (verbose) {
    if (seconds < 90)  return "1 minute ago";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60)  return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24)    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    const days = Math.round(hours / 24);
    if (days < 30)     return `${days} ${days === 1 ? "day" : "days"} ago`;
    const months = Math.round(days / 30);
    if (months < 12)   return `${months} ${months === 1 ? "month" : "months"} ago`;
    const years = Math.round(days / 365);
    return `${years} ${years === 1 ? "year" : "years"} ago`;
  }

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
