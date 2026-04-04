<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import type { ChannelWithUnread } from '@harmony/shared/types/channel';
  import type { User } from '@harmony/shared/types/user';
  import { presence } from '$lib/stores/presence.svelte';

  interface Props {
    channel?: ChannelWithUnread | null;
    dmUser?: User | null;
  }

  let { channel = null, dmUser = null }: Props = $props();

  const unreadCount = $derived(notifications.unreadNotificationCount);
</script>

<header
  class="flex items-center gap-3 px-4 bg-bg-primary border-b border-divider shrink-0 shadow-sm z-10"
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
      <!-- Channel header -->
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
      class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
      aria-label="Search"
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
        class="p-1.5 rounded transition-colors
          {ui.memberListOpen
            ? 'text-text-primary bg-bg-active'
            : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}"
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

    <!-- Notifications bell -->
    <div class="relative">
      <button
        class="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}"
        title="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </button>
      {#if unreadCount > 0}
        <span
          class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      {/if}
    </div>
  </div>
</header>
