<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { channels } from '$lib/stores/channels.svelte';
  import { voice } from '$lib/stores/voice.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { presence } from '$lib/stores/presence.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import ChannelList from './ChannelList.svelte';
  import { ChannelType } from '@harmony/shared/types/channel';
  import type { CreateChannelRequest } from '@harmony/shared/types/api';

  const APP_NAME = 'Harmony';

  let creatingChannel = $state(false);
  let newChannelName = $state('');
  let newChannelType = $state<ChannelType>(ChannelType.TEXT);

  async function createChannel(type: ChannelType) {
    const name = prompt(`New ${type === ChannelType.TEXT ? 'text' : 'voice'} channel name:`);
    if (!name?.trim()) return;
    try {
      await channels.createChannel({
        name: name.trim(),
        type,
      } as CreateChannelRequest);
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  }

  function handleLogout() {
    auth.logout();
    goto('/login');
  }

  const userStatus = $derived(
    auth.user ? presence.getPresence(auth.user.id) : undefined
  );
</script>

<aside
  class="flex flex-col bg-bg-secondary shrink-0 overflow-hidden"
  style="width: var(--sidebar-width);"
>
  <!-- Server name header -->
  <div class="px-4 flex items-center justify-between border-b border-divider shadow-sm"
    style="height: var(--header-height);"
  >
    <h1 class="font-semibold text-text-primary truncate text-base">{APP_NAME}</h1>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted shrink-0" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>

  <!-- Channel list area (scrollable) -->
  <div class="flex-1 overflow-y-auto py-2">
    <!-- Text Channels -->
    <div class="mb-1">
      <div class="flex items-center justify-between px-4 py-1 group">
        <button
          class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary transition-colors"
          onclick={() => {}}
          aria-expanded="true"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="transition-transform">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          Text Channels
        </button>
        <button
          class="text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
          onclick={() => createChannel(ChannelType.TEXT)}
          aria-label="Create text channel"
          title="Create text channel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <ChannelList
        items={channels.textChannels}
        type={ChannelType.TEXT}
        activeChannelId={channels.activeChannelId}
      />
    </div>

    <!-- Voice Channels -->
    <div class="mb-1">
      <div class="flex items-center justify-between px-4 py-1 group">
        <button
          class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary transition-colors"
          onclick={() => {}}
          aria-expanded="true"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          Voice Channels
        </button>
        <button
          class="text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
          onclick={() => createChannel(ChannelType.VOICE)}
          aria-label="Create voice channel"
          title="Create voice channel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <ChannelList
        items={channels.voiceChannels}
        type={ChannelType.VOICE}
        activeChannelId={channels.activeChannelId}
        voiceParticipants={voice.participants}
      />
    </div>

    <!-- Direct Messages -->
    {#if channels.dmChannels.length > 0}
      <div class="mb-1">
        <div class="flex items-center px-4 py-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Direct Messages
          </span>
        </div>
        {#each channels.dmChannels as dm}
          {@const otherUserId = dm.user1Id === auth.user?.id ? dm.user2Id : dm.user1Id}
          <button
            class="w-full flex items-center gap-2 px-2 py-1 mx-2 rounded group transition-colors text-left
              {channels.activeChannelId === dm.channelId
                ? 'bg-bg-active text-text-primary'
                : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary'}"
            style="width: calc(100% - 16px);"
            onclick={() => {
              channels.setActiveChannel(dm.channelId);
              goto(`/dm/${otherUserId}`);
            }}
          >
            <Avatar
              username={otherUserId}
              size="sm"
              status={presence.getPresence(otherUserId)}
            />
            <span class="truncate text-sm">{otherUserId}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- User panel at bottom -->
  {#if auth.user}
    <div class="flex items-center gap-2 px-2 py-2 bg-bg-tertiary border-t border-divider">
      <Avatar
        src={auth.user.avatarPath}
        username={auth.user.displayName || auth.user.username}
        size="sm"
        status={userStatus}
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-text-primary truncate leading-tight">
          {auth.user.displayName || auth.user.username}
        </p>
        <p class="text-xs text-text-muted truncate leading-tight">
          #{auth.user.username}
        </p>
      </div>
      <button
        class="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-hover shrink-0"
        onclick={() => goto('/settings')}
        aria-label="User settings"
        title="User Settings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  {/if}
</aside>
