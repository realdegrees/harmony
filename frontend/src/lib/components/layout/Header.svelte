<script lang="ts">
  import { goto } from '$app/navigation';
  import { ui } from '$lib/stores/ui.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import SearchBar from '$lib/components/search/SearchBar.svelte';
  import SearchResults from '$lib/components/search/SearchResults.svelte';
  import type { ChannelWithUnread } from '@harmony/shared/types/channel';
  import type { User } from '@harmony/shared/types/user';
  import type { SearchFilters } from '@harmony/shared/types/message';
  import { ChannelType } from '@harmony/shared/types/channel';
  import { NotificationType } from '@harmony/shared/types/notification';
  import { presence } from '$lib/stores/presence.svelte';

  interface Props {
    channel?: ChannelWithUnread | null;
    dmUser?: User | null;
  }

  let { channel = null, dmUser = null }: Props = $props();

  const unreadCount = $derived(notifications.unreadNotificationCount);
  let searchOpen = $state(false);
  let searchFilters = $state<SearchFilters | null>(null);
  let notifOpen = $state(false);

  function notifLabel(type: NotificationType): string {
    switch (type) {
      case NotificationType.MENTION: return 'Mentioned you';
      case NotificationType.DM: return 'Direct message';
      case NotificationType.CHANNEL_MESSAGE: return 'New message';
      default: return 'Notification';
    }
  }

  function notifTime(iso: string): string {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  }

  async function handleNotifClick(id: string, channelId: string | null) {
    await notifications.markRead(id);
    if (channelId) goto(`/channels/${channelId}`);
    notifOpen = false;
  }
</script>

<header
  class="relative flex items-center gap-3 px-4 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.06] shrink-0 z-10"
  style="height: var(--header-height);"
>
  <!-- Left: Channel/DM info -->
  <div class="flex items-center gap-2 flex-1 min-w-0">
    {#if dmUser}
      <!-- DM header -->
      <Avatar
        src={dmUser.avatarPath}
        username={dmUser.displayName || dmUser.username}
        size="sm"
        status={presence.getPresence(dmUser.id)}
      />
      <div class="min-w-0">
        <span class="font-semibold text-text-primary text-sm truncate">
          {dmUser.displayName || dmUser.username}
        </span>
      </div>
    {:else if channel}
      <!-- Channel icon: speaker for voice, hash for text -->
      {#if channel.type === ChannelType.VOICE}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="text-channel-icon shrink-0"
          aria-hidden="true"
        >
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      {:else}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-channel-icon shrink-0"
          aria-hidden="true"
        >
          <line x1="4" y1="9" x2="20" y2="9"></line>
          <line x1="4" y1="15" x2="20" y2="15"></line>
          <line x1="10" y1="3" x2="8" y2="21"></line>
          <line x1="16" y1="3" x2="14" y2="21"></line>
        </svg>
      {/if}
      <span class="font-semibold text-text-primary text-sm">{channel.name}</span>

      {#if channel.topic}
        <div class="w-px h-4 bg-divider mx-1 shrink-0"></div>
        <span class="text-sm text-text-muted truncate">{channel.topic}</span>
      {/if}
    {/if}
  </div>

  <!-- Right: Actions -->
  <div class="flex items-center gap-1 shrink-0">
    <!-- Search -->
    <button
      class="p-1.5 rounded-lg transition-all duration-100
        {searchOpen
          ? 'text-text-primary bg-white/[0.12]'
          : 'text-text-muted hover:text-text-primary hover:bg-white/[0.07]'}"
      onclick={() => { searchOpen = !searchOpen; }}
      aria-label="Search"
      aria-pressed={searchOpen}
      title="Search"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </button>

    <!-- Member list toggle (only for channels, not DMs) -->
    {#if !dmUser}
      <button
        class="p-1.5 rounded-lg transition-all duration-100
          {ui.memberListOpen
            ? 'text-text-primary bg-white/[0.12]'
            : 'text-text-muted hover:text-text-primary hover:bg-white/[0.07]'}"
        onclick={() => ui.toggleMemberList()}
        aria-label="Toggle member list"
        aria-pressed={ui.memberListOpen}
        title="Member List"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </button>
    {/if}

    <!-- Notifications bell + dropdown -->
    <div class="relative flex items-center">
      <Badge count={unreadCount}>
        <button
          class="p-1.5 rounded-lg transition-all duration-100
            {notifOpen
              ? 'text-text-primary bg-white/[0.12]'
              : 'text-text-muted hover:text-text-primary hover:bg-white/[0.07]'}"
          onclick={() => (notifOpen = !notifOpen)}
          aria-label="Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}"
          aria-pressed={notifOpen}
          title="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>
      </Badge>

      <!-- Notification dropdown -->
      {#if notifOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fixed inset-0 z-40" onclick={() => (notifOpen = false)}></div>
        <div
          class="fixed right-4 z-50 w-80
                 bg-white/[0.07] backdrop-blur-2xl
                 border border-white/[0.10]
                 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)]
                 flex flex-col overflow-hidden"
          style="top: calc(var(--header-height) + 8px); max-height: min(480px, calc(100vh - var(--header-height) - 24px));"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0">
            <h2 class="text-sm font-bold text-text-primary">Notifications</h2>
            {#if unreadCount > 0}
              <button
                class="text-xs text-brand hover:text-brand-hover transition-colors font-medium"
                onclick={() => notifications.markAllRead()}
              >
                Mark all read
              </button>
            {/if}
          </div>

          <!-- List -->
          <div class="overflow-y-auto flex-1">
            {#if notifications.notifications.length === 0}
              <div class="flex flex-col items-center justify-center gap-2 py-10 text-text-muted text-sm">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="opacity-30" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <p>Nothing here yet</p>
              </div>
            {:else}
              {#each notifications.notifications as notif (notif.id)}
                <button
                  class="w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-100
                         hover:bg-white/[0.05] border-b border-white/[0.04] last:border-0
                         {notif.read ? 'opacity-50' : ''}"
                  onclick={() => handleNotifClick(notif.id, notif.channelId)}
                >
                  <!-- Unread dot -->
                  <span class="mt-1.5 shrink-0 w-2 h-2 rounded-full {notif.read ? 'bg-transparent' : 'bg-brand shadow-[0_0_6px_rgba(92,110,240,0.6)]'}"></span>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-text-secondary">{notifLabel(notif.type)}</p>
                    {#if notif.channelId}
                      <p class="text-xs text-text-muted truncate">In a channel</p>
                    {/if}
                    <p class="text-[10px] text-text-muted mt-0.5">{notifTime(notif.createdAt)}</p>
                  </div>
                  {#if !notif.read}
                    <!-- svelte-ignore a11y_interactive_supports_focus -->
                    <span
                      role="button"
                      class="shrink-0 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.10] transition-all cursor-pointer"
                      onclick={(e) => { e.stopPropagation(); notifications.markRead(notif.id); }}
                      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); notifications.markRead(notif.id); } }}
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    </span>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<!-- Search panel — fixed so it escapes overflow:hidden on parent containers -->
{#if searchOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40" onclick={() => { searchOpen = false; searchFilters = null; }}></div>
  <div
    class="fixed right-4 z-50 w-full max-w-md shadow-[0_16px_48px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-white/[0.08]"
    style="top: calc(var(--header-height) + 8px);"
  >
    <SearchBar
      onsearch={(filters) => { searchFilters = filters; }}
    />
    {#if searchFilters}
      <SearchResults
        filters={searchFilters}
        onclose={() => { searchOpen = false; searchFilters = null; }}
      />
    {/if}
  </div>
{/if}
