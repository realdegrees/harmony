<script lang="ts">
  import { UserStatus } from '@harmony/shared/types/user';
  import { auth } from '$lib/stores/auth.svelte';
  import { ws } from '$lib/api/ws';

  interface Props {
    onclose?: () => void;
  }

  let { onclose }: Props = $props();

  interface StatusOption {
    status: UserStatus;
    label: string;
    description?: string;
    color: string;
    selectable: boolean;
  }

  const STATUS_OPTIONS: StatusOption[] = [
    {
      status: UserStatus.ONLINE,
      label: 'Online',
      color: 'bg-online',
      selectable: true,
    },
    {
      status: UserStatus.BUSY,
      label: 'Do Not Disturb',
      description: 'Suppresses notifications',
      color: 'bg-busy',
      selectable: true,
    },
    {
      status: UserStatus.APPEAR_OFFLINE,
      label: 'Appear Offline',
      description: 'You\'ll appear as offline to others',
      color: 'bg-offline',
      selectable: true,
    },
  ];

  const currentStatus = $derived(auth.user?.status ?? UserStatus.ONLINE);

  function selectStatus(status: UserStatus) {
    ws.send({ type: 'presence:update', data: { status } });
    // Optimistically update local user state
    if (auth.user) {
      auth.updateUser({ ...auth.user, status });
    }
    onclose?.();
  }

  let containerEl = $state<HTMLDivElement | undefined>(undefined);

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      onclose?.();
    }
  }

  $effect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });
</script>

<div
  bind:this={containerEl}
  class="w-56 bg-bg-floating rounded-lg shadow-2xl border border-divider py-1.5 overflow-hidden"
  role="menu"
  aria-label="Set status"
>
  <p class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
    Set Status
  </p>

  {#each STATUS_OPTIONS as option (option.status)}
    <button
      onclick={() => selectStatus(option.status)}
      disabled={!option.selectable}
      class="
        w-full flex items-start gap-3 px-3 py-2.5 text-left
        hover:bg-bg-hover transition-colors duration-100
        disabled:opacity-50 disabled:cursor-not-allowed
        {currentStatus === option.status ? 'bg-bg-hover' : ''}
      "
      role="menuitemradio"
      aria-checked={currentStatus === option.status}
    >
      <!-- Status dot -->
      <span class="mt-0.5 shrink-0 relative">
        <span class="block w-3 h-3 rounded-full {option.color}"></span>
        {#if currentStatus === option.status}
          <span class="absolute inset-0 rounded-full ring-2 ring-white/20"></span>
        {/if}
      </span>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-text-primary truncate">{option.label}</span>
          {#if currentStatus === option.status}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-brand shrink-0" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          {/if}
        </div>
        {#if option.description}
          <p class="text-xs text-text-muted mt-0.5">{option.description}</p>
        {/if}
      </div>
    </button>
  {/each}

  <!-- Divider -->
  <div class="my-1.5 border-t border-divider"></div>

  <!-- Info about offline status -->
  <div class="px-3 py-1.5">
    <div class="flex items-start gap-3">
      <span class="mt-0.5 shrink-0 block w-3 h-3 rounded-full bg-offline opacity-50"></span>
      <div>
        <span class="text-sm text-text-muted">Offline</span>
        <p class="text-xs text-text-muted opacity-75">Set automatically when disconnected</p>
      </div>
    </div>
  </div>
</div>
