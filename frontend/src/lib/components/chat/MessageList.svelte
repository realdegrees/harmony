<script lang="ts">
  import { tick } from 'svelte';
  import { messages as messagesStore } from '$lib/stores/messages.svelte';
  import Message from './Message.svelte';
  import TypingIndicator from './TypingIndicator.svelte';
  import type { Message as MessageType } from '@harmony/shared/types/message';

  interface Props {
    channelId: string;
  }

  let { channelId }: Props = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let atBottom = $state(true);
  let loadingMore = $state(false);
  let highlightedId = $state<string | null>(null);

  const channelMessages = $derived(messagesStore.getMessages(channelId));
  const hasMore = $derived(messagesStore.hasMore.get(channelId) ?? false);
  const isLoading = $derived(messagesStore.isLoading);

  $effect(() => {
    // When channelId changes, fetch messages
    void channelId;
    fetchInitial();
  });

  async function fetchInitial() {
    await messagesStore.fetchMessages(channelId);
    await tick();
    scrollToBottom();
  }

  $effect(() => {
    // Auto-scroll when new messages arrive and we're at the bottom
    const _ = channelMessages.length;
    if (atBottom) {
      tick().then(scrollToBottom);
    }
  });

  function scrollToBottom() {
    if (containerEl) {
      containerEl.scrollTop = containerEl.scrollHeight;
    }
  }

  function handleScroll() {
    if (!containerEl) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    atBottom = scrollHeight - scrollTop - clientHeight < 50;

    // Load more when scrolling to the top
    if (scrollTop < 100 && hasMore && !loadingMore && !isLoading) {
      loadMore();
    }
  }

  async function loadMore() {
    if (!containerEl) return;
    loadingMore = true;
    const prevHeight = containerEl.scrollHeight;
    const prevTop = containerEl.scrollTop;

    try {
      await messagesStore.loadMore(channelId);
      await tick();
      // Preserve scroll position after prepending old messages
      const newHeight = containerEl.scrollHeight;
      containerEl.scrollTop = prevTop + (newHeight - prevHeight);
    } finally {
      loadingMore = false;
    }
  }

  function scrollToMessage(id: string) {
    const el = containerEl?.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightedId = id;
      setTimeout(() => {
        highlightedId = null;
      }, 2000);
    }
  }

  // Group messages: compact if same author within 5 min of previous
  interface GroupedMessage {
    message: MessageType;
    isCompact: boolean;
    showDateSeparator: boolean;
    date: string;
  }

  const groupedMessages = $derived(
    channelMessages.map((msg, i): GroupedMessage => {
      const prev = channelMessages[i - 1];
      const msgDate = new Date(msg.createdAt);
      const prevDate = prev ? new Date(prev.createdAt) : null;

      const sameAuthor = prev?.authorId === msg.authorId;
      const withinFiveMin = prevDate
        ? msgDate.getTime() - prevDate.getTime() < 5 * 60 * 1000
        : false;
      const hasReply = !!msg.replyTo;

      const isCompact = sameAuthor && withinFiveMin && !hasReply;

      const showDateSeparator =
        !prevDate ||
        msgDate.toDateString() !== prevDate.toDateString();

      return {
        message: msg,
        isCompact,
        showDateSeparator,
        date: msgDate.toLocaleDateString([], {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      };
    })
  );
</script>

<div
  class="flex-1 overflow-y-auto flex flex-col"
  bind:this={containerEl}
  onscroll={handleScroll}
  role="log"
  aria-label="Messages"
  aria-live="polite"
>
  <!-- Loading more spinner at top -->
  {#if loadingMore || (isLoading && channelMessages.length === 0)}
    <div class="flex items-center justify-center py-4">
      <svg class="animate-spin text-text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <span class="sr-only">Loading messages...</span>
    </div>
  {/if}

  <!-- "Load more" indicator if there's more history -->
  {#if hasMore && !loadingMore}
    <div class="text-center py-2">
      <button
        class="text-xs text-text-link hover:text-text-primary transition-colors"
        onclick={loadMore}
      >
        Load older messages
      </button>
    </div>
  {/if}

  <!-- Empty state -->
  {#if channelMessages.length === 0 && !isLoading}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center text-text-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-3 opacity-30" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p class="text-sm">No messages yet. Be the first to say something!</p>
      </div>
    </div>
  {/if}

  <!-- Messages -->
  <div class="flex flex-col pb-2 min-h-0">
    {#each groupedMessages as { message, isCompact, showDateSeparator, date } (message.id)}
      <!-- Date separator -->
      {#if showDateSeparator}
        <div class="flex items-center gap-3 px-4 my-4" role="separator">
          <div class="flex-1 h-px bg-divider"></div>
          <span class="text-xs font-semibold text-text-muted shrink-0">{date}</span>
          <div class="flex-1 h-px bg-divider"></div>
        </div>
      {/if}

      <div class="relative">
        <Message
          {message}
          {isCompact}
          isHighlighted={highlightedId === message.id}
          onScrollTo={scrollToMessage}
        />
      </div>
    {/each}
  </div>
</div>

<!-- Typing indicator -->
<TypingIndicator {channelId} />
