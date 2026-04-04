<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { channels } from '$lib/stores/channels.svelte';
  import { voice } from '$lib/stores/voice.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { presence } from '$lib/stores/presence.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import PromptModal from '$lib/components/ui/PromptModal.svelte';
  import ChannelList from './ChannelList.svelte';
  import VoiceControls from '$lib/components/voice/VoiceControls.svelte';
  import Soundboard from '$lib/components/voice/Soundboard.svelte';
  import StatusSelector from '$lib/components/user/StatusSelector.svelte';
  import { ChannelType } from '@harmony/shared/types/channel';
  import type { ChannelCategoryWithChannels } from '@harmony/shared/types/channel';
  import type { CreateChannelRequest } from '@harmony/shared/types/api';

  const APP_NAME = 'Harmony';

  // ── Server header dropdown ────────────────────────────────────────────────
  let serverMenuOpen = $state(false);

  // ── PromptModal state ─────────────────────────────────────────────────────
  type ModalIntent =
    | { kind: 'createCategory' }
    | { kind: 'createTextChannel'; categoryId: string | null }
    | { kind: 'createVoiceChannel'; categoryId: string | null }
    | { kind: 'renameCategory'; cat: ChannelCategoryWithChannels };

  let modalOpen = $state(false);
  let modalIntent = $state<ModalIntent | null>(null);

  function openModal(intent: ModalIntent) {
    modalIntent = intent;
    modalOpen = true;
    serverMenuOpen = false;
  }

  function getModalProps(): { title: string; description?: string; placeholder: string; confirmLabel: string } {
    if (!modalIntent) return { title: '', placeholder: '', confirmLabel: 'OK' };
    switch (modalIntent.kind) {
      case 'createCategory':
        return { title: 'New Category', placeholder: 'Category name', confirmLabel: 'Create' };
      case 'createTextChannel':
        return { title: 'New Text Channel', placeholder: 'channel-name', confirmLabel: 'Create' };
      case 'createVoiceChannel':
        return { title: 'New Voice Channel', placeholder: 'Channel name', confirmLabel: 'Create' };
      case 'renameCategory':
        return { title: `Rename "${modalIntent.cat.name}"`, placeholder: 'New name', confirmLabel: 'Save', description: 'Enter a new name for this category.' };
    }
  }

  let promptModalEl = $state<{ setError: (msg: string) => void } | null>(null);

  async function handleModalConfirm(name: string) {
    if (!modalIntent) return;
    try {
      switch (modalIntent.kind) {
        case 'createCategory':
          await channels.createCategory({ name });
          break;
        case 'createTextChannel':
          await channels.createChannel({ name, type: ChannelType.TEXT, categoryId: modalIntent.categoryId ?? undefined } as CreateChannelRequest);
          await channels.fetchCategories();
          break;
        case 'createVoiceChannel':
          await channels.createChannel({ name, type: ChannelType.VOICE, categoryId: modalIntent.categoryId ?? undefined } as CreateChannelRequest);
          await channels.fetchCategories();
          break;
        case 'renameCategory':
          if (name !== modalIntent.cat.name)
            await channels.updateCategory(modalIntent.cat.id, { name });
          break;
      }
      // Success — close
      modalOpen = false;
      modalIntent = null;
    } catch (err) {
      // Show error inside the modal instead of silently failing
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      promptModalEl?.setError(msg);
    }
  }

  // ── Category context menu ─────────────────────────────────────────────────
  function handleCategoryContextMenu(e: MouseEvent, cat: ChannelCategoryWithChannels) {
    e.preventDefault();
    ui.showContextMenu(e.clientX, e.clientY, [
      { label: 'Create Text Channel', action: () => openModal({ kind: 'createTextChannel', categoryId: cat.id }) },
      { label: 'Create Voice Channel', action: () => openModal({ kind: 'createVoiceChannel', categoryId: cat.id }) },
      { label: '', action: () => {}, divider: true },
      { label: 'Rename Category', action: () => openModal({ kind: 'renameCategory', cat }) },
      {
        label: 'Delete Category',
        danger: true,
        action: async () => {
          // Use a small modal-less guard — could be replaced with ConfirmModal later
          try { await channels.deleteCategory(cat.id); } catch (err) { console.error(err); }
        },
      },
    ]);
  }

  function handleLogout() {
    auth.logout();
    goto('/login');
  }

  const userStatus = $derived(auth.user ? presence.getPresence(auth.user.id) : undefined);
  const modalProps = $derived(getModalProps());

  // ── Soundboard ────────────────────────────────────────────────────────────
  let soundboardOpen = $state(false);

  // ── Status selector ───────────────────────────────────────────────────────
  let statusSelectorOpen = $state(false);
  let statusAnchorStyle = $state('');
</script>

<!-- Shared prompt modal -->
<PromptModal
  bind:this={promptModalEl}
  open={modalOpen}
  title={modalProps.title}
  description={modalProps.description}
  placeholder={modalProps.placeholder}
  confirmLabel={modalProps.confirmLabel}
  onconfirm={handleModalConfirm}
  oncancel={() => { modalOpen = false; modalIntent = null; }}
/>

<aside
  class="flex flex-col shrink-0 overflow-hidden bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.06]"
  style="width: var(--sidebar-width);"
>
  <!-- Server name header (clickable → dropdown) -->
  <div class="relative">
    <button
      class="w-full px-4 flex items-center justify-between border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors"
      style="height: var(--header-height);"
      onclick={() => (serverMenuOpen = !serverMenuOpen)}
      aria-haspopup="true"
      aria-expanded={serverMenuOpen}
    >
      <h1 class="font-bold text-text-primary truncate text-base tracking-tight">{APP_NAME}</h1>
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        class="text-text-muted shrink-0 transition-transform duration-150 {serverMenuOpen ? 'rotate-180' : ''}"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <!-- Server dropdown menu -->
    {#if serverMenuOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="fixed inset-0 z-40" onclick={() => (serverMenuOpen = false)}></div>
      <div class="absolute top-full left-0 right-0 z-50 mx-2 mt-1
                  bg-[#1a1c26] rounded-xl
                  border border-white/[0.12] shadow-[0_16px_48px_rgba(0,0,0,0.7)]
                  py-1.5 flex flex-col gap-0.5">
        <button
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-white/[0.08] hover:text-text-primary rounded-lg mx-1 transition-all duration-100 text-left"
          onclick={() => openModal({ kind: 'createCategory' })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 6h-2.18c.07-.44.18-.88.18-1.38 0-2.55-2.07-4.62-4.62-4.62-1.38 0-2.55.57-3.43 1.47L9 3l-1.88-1.53C6.24 .57 5.07 0 3.62 0 1.07 0-1 2.07-.9 4.62c0 .5.11.94.18 1.38H-2V20h22V6zM11.56 3.35C12.09 2.83 12.82 2.5 13.38 2.5c1.38 0 2.5 1.12 2.5 2.5 0 .5-.1.88-.18 1h-5.33l1.19-2.65zM6.22 2.5c.56 0 1.29.33 1.82.85L9.23 6H3.9c-.08-.12-.18-.5-.18-1 0-1.38 1.12-2.5 2.5-2.5zM18 18H6V8h12v10z"/>
          </svg>
          Create Category
        </button>
        <button
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-white/[0.08] hover:text-text-primary rounded-lg mx-1 transition-all duration-100 text-left"
          onclick={() => openModal({ kind: 'createTextChannel', categoryId: null })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line>
            <line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>
          </svg>
          Create Text Channel
        </button>
        <button
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-white/[0.08] hover:text-text-primary rounded-lg mx-1 transition-all duration-100 text-left"
          onclick={() => openModal({ kind: 'createVoiceChannel', categoryId: null })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          Create Voice Channel
        </button>
        <div class="my-1 border-t border-white/[0.07] mx-2"></div>
        <button
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 rounded-lg mx-1 transition-all duration-100 text-left"
          onclick={handleLogout}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          Log Out
        </button>
      </div>
    {/if}
  </div>

  <!-- Channel list area (scrollable) -->
  <div class="flex-1 overflow-y-auto py-2">

    <!-- Section header -->
    <div class="flex items-center justify-between px-4 pb-1">
      <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Channels</span>
      <button
        class="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-white/[0.06]"
        onclick={() => openModal({ kind: 'createCategory' })}
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
        <div class="flex items-center justify-between px-2 py-1 group">
          <button
            class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted hover:text-text-secondary transition-colors flex-1 min-w-0"
            onclick={() => channels.toggleCategoryCollapsed(cat.id)}
            aria-expanded={!cat.collapsed}
            aria-label="Toggle {cat.name}"
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
              aria-hidden="true"
              class="shrink-0 transition-transform duration-150 {cat.collapsed ? '-rotate-90' : ''}"
            >
              <path d="M7 10l5 5 5-5z"/>
            </svg>
            <span class="truncate">{cat.name}</span>
          </button>
          <!-- Category add button -->
          <button
            class="text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-1 p-0.5 rounded hover:bg-white/[0.06]"
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
          <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
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
            <Avatar username={otherUserId} size="sm" status={presence.getPresence(otherUserId)} />
            <span class="truncate text-sm">{otherUserId}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Soundboard panel (above voice controls when open) -->
  {#if voice.currentChannelId && soundboardOpen}
    <div class="border-t border-white/[0.06] max-h-72 overflow-hidden flex flex-col">
      <Soundboard />
    </div>
  {/if}

  <!-- Voice controls -->
  {#if voice.currentChannelId}
    {@const voiceChannel = channels.channels.find(c => c.id === voice.currentChannelId)}
    <VoiceControls
      channelName={voiceChannel?.name ?? 'Voice Channel'}
      bind:soundboardOpen
    />
  {/if}

  <!-- User panel at bottom -->
  {#if auth.user}
    <div class="relative flex items-center gap-2 px-2.5 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
      <!-- Clickable avatar + name area — opens status selector -->
      <button
        class="flex items-center gap-2 flex-1 min-w-0 rounded-lg p-1 -m-1 hover:bg-white/[0.06] transition-all duration-100 text-left"
        onclick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          statusAnchorStyle = `bottom:${window.innerHeight - rect.top + 8}px;left:${rect.left}px;`;
          statusSelectorOpen = !statusSelectorOpen;
        }}
        aria-label="Set status"
        title="Set Status"
      >
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
      </button>

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

<!-- Status selector popup at fixed position above the user panel -->
{#if statusSelectorOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={() => (statusSelectorOpen = false)}></div>
  <div class="fixed z-50" style={statusAnchorStyle}>
    <StatusSelector onclose={() => (statusSelectorOpen = false)} />
  </div>
{/if}
