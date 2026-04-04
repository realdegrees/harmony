<script lang="ts">
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import type { Message } from '@harmony/shared/types/message';

  interface Props {
    replyTo: Pick<Message, 'id' | 'content' | 'authorId' | 'author'>;
    onScrollTo?: (id: string) => void;
  }

  let { replyTo, onScrollTo }: Props = $props();

  const truncated = $derived(
    replyTo.content.length > 100
      ? replyTo.content.slice(0, 100) + '…'
      : replyTo.content
  );
</script>

<button
  class="flex items-center gap-1.5 mb-0.5 text-xs text-text-muted hover:text-text-secondary transition-colors group max-w-full"
  onclick={() => onScrollTo?.(replyTo.id)}
  aria-label="Jump to original message from {replyTo.author.displayName || replyTo.author.username}"
>
  <!-- Curved connector line -->
  <svg width="36" height="24" viewBox="0 0 36 24" fill="none" class="shrink-0 -mb-1 text-text-muted/40">
    <path
      d="M36 20 Q12 20 12 4"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      fill="none"
    />
  </svg>
  <Avatar
    src={replyTo.author.avatarPath}
    username={replyTo.author.displayName || replyTo.author.username}
    size="xs"
  />
  <span class="font-semibold text-text-secondary group-hover:text-text-primary shrink-0">
    {replyTo.author.displayName || replyTo.author.username}
  </span>
  <span class="truncate group-hover:text-text-secondary">{truncated || '(empty message)'}</span>
</button>
