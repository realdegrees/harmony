<script lang="ts">
  import { ws } from '$lib/api/ws';
  import type { TypingUpdatePayload } from '@harmony/shared/types/ws-events';

  interface Props {
    channelId: string;
  }

  let { channelId }: Props = $props();

  interface TypingUser {
    userId: string;
    username: string;
    expiresAt: number;
  }

  let typingUsers = $state<TypingUser[]>([]);

  $effect(() => {
    // Re-subscribe when channelId changes; clear state
    typingUsers = [];
    const currentChannelId = channelId;

    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      typingUsers = typingUsers.filter((u) => u.expiresAt > now);
    }, 1000);

    const off = ws.on<TypingUpdatePayload>('typing:update', (data) => {
      if (data.channelId !== currentChannelId) return;
      const existing = typingUsers.find((u) => u.userId === data.userId);
      if (existing) {
        existing.expiresAt = Date.now() + 4000;
        typingUsers = [...typingUsers];
      } else {
        typingUsers = [
          ...typingUsers,
          { userId: data.userId, username: data.username, expiresAt: Date.now() + 4000 },
        ];
      }
    });

    return () => {
      off();
      clearInterval(cleanupTimer);
    };
  });

  const label = $derived.by((): string => {
    const names = typingUsers.map((u) => u.username);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    if (names.length <= 5) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing`;
    return 'Several people are typing';
  });
</script>

<style>
  .dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    animation: bounce 1.2s infinite ease-in-out;
  }
  .dot:nth-child(1) { animation-delay: 0s; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }
</style>

{#if typingUsers.length > 0}
  <div class="flex items-center gap-1.5 px-4 pb-1 h-5 text-xs text-text-muted" aria-live="polite">
    <span class="flex items-center gap-0.5 mr-0.5">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </span>
    <span>{label}</span>
  </div>
{:else}
  <div class="h-5"></div>
{/if}
