<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { channels } from '$lib/stores/channels.svelte';
  import { voice } from '$lib/stores/voice.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { presence } from '$lib/stores/presence.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import ChannelList from './ChannelList.svelte';
  import VoiceControls from '$lib/components/voice/VoiceControls.svelte';
  import { ChannelType } from '@harmony/shared/types/channel';
  import type { ChannelCategoryWithChannels } from '@harmony/shared/types/channel';
  import type { CreateChannelRequest } from '@harmony/shared/types/api';

  const APP_NAME = 'Harmony';

  // ---------------------------------------------------------------------------
  // Create channel in a category
  // ---------------------------------------------------------------------------
  async function createChannelInCategory(categoryId: string | null, type: ChannelType) {
    const label = type === ChannelType.TEXT ? 'text' : 'voice';
    const name = prompt(`New ${label} channel name:`);
    if (!name?.trim()) return;
    try {
      await channels.createChannel({
        name: name.trim(),
        type,
        categoryId: categoryId ?? undefined,
      } as CreateChannelRequest);
      // Refresh categories so the new channel appears in the right bucket
      await channels.fetchCategories();
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Create category
  // ---------------------------------------------------------------------------
  async function createCategory() {
    const name = prompt('New category name:');
    if (!name?.trim()) return;
    try {
      await channels.createCategory({ name: name.trim() });
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Category context menu
  // ---------------------------------------------------------------------------
  function handleCategoryContextMenu(e: MouseEvent, cat: ChannelCategoryWithChannels) {
    e.preventDefault();
    ui.showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Create Text Channel',
        action: () => createChannelInCategory(cat.id, ChannelType.TEXT),
      },
      {
        label: 'Create Voice Channel',
        action: () => createChannelInCategory(cat.id, ChannelType.VOICE),
      },
      { label: '', action: () => {}, divider: true },
      {
        label: 'Edit Category',
        action: async () => {
          const name = prompt('Rename category:', cat.name);
          if (!name?.trim() || name.trim() === cat.name) return;
          try {
            await channels.updateCategory(cat.id, { name: name.trim() });
          } catch (err) {
            console.error('Failed to rename category:', err);
          }
        },
      },
      {
        label: 'Delete Category',
        danger: true,
        action: async () => {
          if (confirm(`Delete category "${cat.name}"? Channels will become uncategorized.`)) {
            try {
              await channels.deleteCategory(cat.id);
            } catch (err) {
              console.error('Failed to delete category:', err);
            }
          }
        },
      },
    ]);
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
  class="flex flex-col shrink-0 overflow-hidden bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.06]"
  style="width: var(--sidebar-width);"
>
  <!-- Server name header -->
  <div class="px-4 flex items-center justify-between border-b border-white/[0.06]"
    style="height: var(--header-height);"
  >
    <h1 class="font-bold text-text-primary truncate text-base tracking-tight">{APP_NAME}</h1>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted shrink-0" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>

  <!-- Channel list area (scrollable) -->
  <div class="flex-1 overflow-y-auto py-2">

    <!-- Create Category button -->
    <div class="flex items-center justify-between px-4 pb-1">
      <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Channels</span>
      <button
        class="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-white/[0.06]"
        onclick={createCategory}
        aria-label="Create category"
        title="Create category"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <!-- Uncategorized channels -->
    {#if channels.uncategorizedChannels.filter(c => c.type === ChannelType.TEXT).length > 0}
      <div class="mb-1">
        <ChannelList
          items={channels.uncategorizedChannels.filter(c => c.type === ChannelType.TEXT)}
          type={ChannelType.TEXT}
          activeChannelId={channels.activeChannelId}
        />
      </div>
    {/if}
    {#if channels.uncategorizedChannels.filter(c => c.type === ChannelType.VOICE).length > 0}
      <div class="mb-1">
        <ChannelList
          items={channels.uncategorizedChannels.filter(c => c.type === ChannelType.VOICE)}
          type={ChannelType.VOICE}
          activeChannelId={channels.activeChannelId}
          voiceParticipants={voice.participants}
        />
      </div>
    {/if}

    <!-- Categories -->
    {#each channels.channelsByCategory as cat (cat.id)}
      {@const textChannels = cat.channels.filter(c => c.type === ChannelType.TEXT)}
      {@const voiceChannels = cat.channels.filter(c => c.type === ChannelType.VOICE)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="mb-1" oncontextmenu={(e) => handleCategoryContextMenu(e, cat)}>
        <!-- Category header -->
        <div class="flex items-center justify-between px-2 py-1 group">
          <button
            class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted hover:text-text-secondary transition-colors flex-1 min-w-0"
            onclick={() => channels.toggleCategoryCollapsed(cat.id)}
            aria-expanded={!cat.collapsed}
            aria-label="Toggle {cat.name}"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              class="shrink-0 transition-transform duration-150 {cat.collapsed ? '-rotate-90' : ''}"
            >
              <path d="M7 10l5 5 5-5z"/>
            </svg>
            <span class="truncate">{cat.name}</span>
          </button>
          <!-- Add channel to category button -->
          <button
            class="text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-1"
            onclick={(e) => { e.stopPropagation(); handleCategoryContextMenu(e, cat); }}
            aria-label="Category options for {cat.name}"
            title="Add channel or manage category"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <!-- Category channels (hidden when collapsed) -->
        {#if !cat.collapsed}
          {#if textChannels.length > 0}
            <ChannelList
              items={textChannels}
              type={ChannelType.TEXT}
              activeChannelId={channels.activeChannelId}
            />
          {/if}
          {#if voiceChannels.length > 0}
            <ChannelList
              items={voiceChannels}
              type={ChannelType.VOICE}
              activeChannelId={channels.activeChannelId}
              voiceParticipants={voice.participants}
            />
          {/if}
        {/if}
      </div>
    {/each}

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
            class="w-full flex items-center gap-2 px-2 py-1.5 mx-2 rounded-lg group transition-all duration-100 text-left
              {channels.activeChannelId === dm.channelId
                ? 'bg-white/[0.10] text-text-primary shadow-sm'
                : 'text-text-muted hover:bg-white/[0.05] hover:text-text-secondary'}"
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

  <!-- Voice controls (shown when in a voice channel) -->
  {#if voice.currentChannelId}
    {@const voiceChannel = channels.channels.find(c => c.id === voice.currentChannelId)}
    <VoiceControls channelName={voiceChannel?.name ?? 'Voice Channel'} />
  {/if}

  <!-- User panel at bottom -->
  {#if auth.user}
    <div class="flex items-center gap-2 px-2.5 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
      <Avatar
        src={auth.user.avatarPath}
        username={auth.user.displayName || auth.user.username}
        size="sm"
        status={userStatus}
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-text-primary truncate leading-tight">
          {auth.user.displayName || auth.user.username}
        </p>
        <p class="text-xs text-text-muted truncate leading-tight">
          #{auth.user.username}
        </p>
      </div>
      <button
        class="text-text-muted hover:text-text-primary transition-all duration-100 p-1.5 rounded-lg hover:bg-white/[0.08] shrink-0"
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
