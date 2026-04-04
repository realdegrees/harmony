// Track typing state with auto-expiry
// channelId -> (userId -> timer)
const typingTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

// Callbacks invoked when a user stops typing (timer expiry or explicit stop)
type StopCallback = (channelId: string, userId: string, username: string) => void;
const stopCallbacks: StopCallback[] = [];

export function onTypingStop(cb: StopCallback): void {
  stopCallbacks.push(cb);
}

const TYPING_TIMEOUT_MS = 5_000;

/**
 * Registers a user as currently typing in the given channel.
 * Resets the 5-second expiry timer on each call.
 * Returns the event data to broadcast, or null if already tracking (timer reset only).
 */
export function startTyping(
  channelId: string,
  userId: string,
  username: string,
): { channelId: string; userId: string; username: string } | null {
  if (!typingTimers.has(channelId)) {
    typingTimers.set(channelId, new Map());
  }
  const channelMap = typingTimers.get(channelId)!;

  const wasAlreadyTyping = channelMap.has(userId);

  // Clear any existing timer so we reset the countdown
  if (wasAlreadyTyping) {
    clearTimeout(channelMap.get(userId)!);
  }

  const timer = setTimeout(() => {
    stopTyping(channelId, userId);
    for (const cb of stopCallbacks) {
      cb(channelId, userId, username);
    }
  }, TYPING_TIMEOUT_MS);

  channelMap.set(userId, timer);

  // Only return broadcast data the first time (new typing event)
  if (!wasAlreadyTyping) {
    return { channelId, userId, username };
  }
  return null;
}

/**
 * Explicitly stops typing for the given user in the given channel.
 * Clears the auto-expire timer.
 */
export function stopTyping(channelId: string, userId: string): void {
  const channelMap = typingTimers.get(channelId);
  if (!channelMap) return;

  const timer = channelMap.get(userId);
  if (timer !== undefined) {
    clearTimeout(timer);
    channelMap.delete(userId);
  }

  if (channelMap.size === 0) {
    typingTimers.delete(channelId);
  }
}

/**
 * Returns the list of userIds currently typing in a channel.
 */
export function getTypingUsers(channelId: string): string[] {
  const channelMap = typingTimers.get(channelId);
  if (!channelMap) return [];
  return Array.from(channelMap.keys());
}
