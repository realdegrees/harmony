/**
 * Formats a date string as a Discord-style timestamp:
 * - "Today at 2:30 PM"
 * - "Yesterday at 11:15 AM"
 * - "MM/DD/YYYY"
 */
export function formatTimestamp(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();

  const dDay = startOfDay(d);
  const today = startOfDay(now);
  const yesterday = startOfDay(new Date(now.getTime() - 86_400_000));

  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (dDay.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (dDay.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeStr}`;
  } else {
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
}

/**
 * Formats a date string as a relative time:
 * - "just now" (< 60s)
 * - "5m ago"
 * - "2h ago"
 * - "3d ago"
 * - Falls back to absolute date for older
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86_400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}h ago`;
  }
  if (diffSec < 2_592_000) {
    const d = Math.floor(diffSec / 86_400);
    return `${d}d ago`;
  }
  // Older than 30 days - show date
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a byte count into a human-readable file size.
 * e.g. 1_234_567 → "1.2 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

/**
 * Formats a duration in seconds to mm:ss or h:mm:ss.
 * e.g. 90 → "1:30", 3661 → "1:01:01"
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Truncates a string to maxLength, appending "…" if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Wraps @mentions of the current user in a <span class="mention self"> element,
 * and other @mentions in <span class="mention">.
 * The returned string is HTML — use {@html} in Svelte.
 */
export function highlightMentions(content: string, currentUserId: string, currentUsername?: string): string {
  // Match @username or @displayname patterns
  return content.replace(/<@!?(\w+)>/g, (match, userId) => {
    if (userId === currentUserId) {
      return `<span class="mention self" data-user-id="${userId}">${match}</span>`;
    }
    return `<span class="mention" data-user-id="${userId}">${match}</span>`;
  }).replace(/@(\w+)/g, (match, username) => {
    if (currentUsername && username.toLowerCase() === currentUsername.toLowerCase()) {
      return `<span class="mention self">${match}</span>`;
    }
    return `<span class="mention">${match}</span>`;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
