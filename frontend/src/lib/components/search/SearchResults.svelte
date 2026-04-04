<script lang="ts">
  import type { Message } from '@harmony/shared/types/message';
  import type { SearchFilters } from '@harmony/shared/types/message';
  import { api } from '$lib/api/client';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { formatTimestamp } from '$lib/utils/format';

  interface Props {
    filters: SearchFilters;
    onclose: () => void;
    onjump?: (message: Message) => void;
  }

  let { filters, onclose, onjump }: Props = $props();

  interface GroupedMessages {
    channelId: string;
    channelName: string;
    messages: Message[];
  }

  let messages = $state<Message[]>([]);
  let isLoading = $state(false);
  let hasMore = $state(false);
  let cursor = $state<string | null>(null);
  let resultCount = $state(0);

  // Group messages by channel
  const grouped = $derived(
    (() => {
      const map = new Map<string, GroupedMessages>();
      for (const msg of messages) {
        if (!map.has(msg.channelId)) {
          map.set(msg.channelId, { channelId: msg.channelId, channelName: `#${msg.channelId}`, messages: [] });
        }
        map.get(msg.channelId)!.messages.push(msg);
      }
      return Array.from(map.values());
    })()
  );

  async function search(reset = true) {
    if (isLoading) return;
    isLoading = true;
    if (reset) {
      messages = [];
      cursor = null;
      resultCount = 0;
    }
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set('query', filters.query);
      if (filters.authorId) params.set('authorId', filters.authorId);
      if (filters.channelId) params.set('channelId', filters.channelId);
      if (filters.hasImage) params.set('hasImage', 'true');
      if (filters.hasLink) params.set('hasLink', 'true');
      if (filters.hasAttachment) params.set('hasAttachment', 'true');
      if (filters.before) params.set('before', filters.before);
      if (filters.after) params.set('after', filters.after);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '25');

      const res = await api.get<{ messages: Message[]; hasMore: boolean; cursor: string | null; total?: number }>(
        `/messages/search?${params.toString()}`
      );
      messages = reset ? res.messages : [...messages, ...res.messages];
      hasMore = res.hasMore;
      cursor = res.cursor;
      if (reset && res.total !== undefined) resultCount = res.total;
    } catch {
      // ignore
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    // Re-run search when filters change
    filters;
    search(true);
  });

  function loadMore() {
    search(false);
  }

  function jumpToMessage(message: Message) {
    onjump?.(message);
  }

  function truncateContent(content: string, maxLen = 120): string {
    if (content.length <= maxLen) return content;
    return content.slice(0, maxLen) + '…';
  }
</script>

<div
  class="
    flex flex-col w-80 h-full
    bg-white/[0.06] backdrop-blur-2xl border-l border-white/[0.08]
    animate-[slideInRight_0.2s_ease-out]
  "
  role="complementary"
  aria-label="Search results"
>
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-3 border-b border-white/[0.07] shrink-0">
    <div>
      <h2 class="text-base font-semibold text-text-primary">Search Results</h2>
      {#if !isLoading && messages.length > 0}
        <p class="text-xs text-text-muted">
          {resultCount > 0 ? `${resultCount} result${resultCount !== 1 ? 's' : ''}` : `${messages.length} found`}
        </p>
      {/if}
    </div>
    <button
      onclick={onclose}
      class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-all duration-100"
      aria-label="Close search results"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  </div>

  <!-- Active filters display -->
  {#if filters.query || filters.authorId || filters.channelId || filters.hasImage || filters.hasLink || filters.hasAttachment}
    <div class="px-3 py-2 border-b border-white/[0.07] flex flex-wrap gap-1 shrink-0">
      {#if filters.query}
        <span class="px-2 py-0.5 rounded-sm bg-brand/20 text-brand text-xs">"{filters.query}"</span>
      {/if}
      {#if filters.hasImage}
        <span class="px-2 py-0.5 rounded-sm bg-bg-accent text-text-secondary text-xs">Has image</span>
      {/if}
      {#if filters.hasLink}
        <span class="px-2 py-0.5 rounded-sm bg-bg-accent text-text-secondary text-xs">Has link</span>
      {/if}
      {#if filters.hasAttachment}
        <span class="px-2 py-0.5 rounded-sm bg-bg-accent text-text-secondary text-xs">Has file</span>
      {/if}
    </div>
  {/if}

  <!-- Results -->
  <div class="flex-1 overflow-y-auto">
    {#if isLoading && messages.length === 0}
      <div class="flex flex-col items-center justify-center h-40 gap-2 text-text-muted">
        <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span class="text-sm">Searching...</span>
      </div>
    {:else if messages.length === 0}
      <div class="flex flex-col items-center justify-center h-40 gap-2 text-text-muted">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="opacity-50" aria-hidden="true">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <span class="text-sm">No results found</span>
      </div>
    {:else}
      {#each grouped as group (group.channelId)}
        <!-- Channel group header -->
        <div class="sticky top-0 px-3 py-1.5 bg-bg-secondary/90 backdrop-blur-sm border-b border-divider z-10">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
            {group.channelName}
          </div>
        </div>

        <!-- Messages in channel -->
        {#each group.messages as message (message.id)}
          <button
            onclick={() => jumpToMessage(message)}
            class="
              w-full flex flex-col gap-1.5 px-3 py-3 text-left
              hover:bg-bg-hover border-b border-divider/50 transition-colors
              focus:outline-none focus:bg-bg-hover
            "
            aria-label="Jump to message from {message.author.displayName}"
          >
            <!-- Author row -->
            <div class="flex items-center gap-2">
              <Avatar
                src={message.author.avatarPath}
                username={message.author.username}
                size="xs"
              />
              <span class="text-xs font-semibold text-text-primary">
                {message.author.displayName || message.author.username}
              </span>
              <span class="text-[10px] text-text-muted ml-auto shrink-0">
                {formatTimestamp(message.createdAt)}
              </span>
            </div>

            <!-- Message content -->
            <p class="text-xs text-text-secondary leading-relaxed line-clamp-3">
              {truncateContent(message.content)}
            </p>

            <!-- Attachments indicator -->
            {#if message.attachments.length > 0}
              <div class="flex items-center gap-1 text-[10px] text-text-muted">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                </svg>
                {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
              </div>
            {/if}

            <!-- Jump arrow hint -->
            <div class="flex items-center justify-end">
              <span class="text-[10px] text-text-muted flex items-center gap-0.5">
                Jump
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </span>
            </div>
          </button>
        {/each}
      {/each}

      <!-- Load more -->
      {#if hasMore}
        <div class="p-3">
          <button
            onclick={loadMore}
            disabled={isLoading}
            class="
              w-full py-2 rounded text-sm font-medium
              bg-bg-accent text-text-secondary hover:bg-bg-hover hover:text-text-primary
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors
            "
          >
            {#if isLoading}
              Loading...
            {:else}
              Load more results
            {/if}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
</style>
