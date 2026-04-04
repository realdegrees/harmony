<script lang="ts">
  import type { UserProfile } from '@harmony/shared/types/user';
  import { UserStatus } from '@harmony/shared/types/user';
  import { api } from '$lib/api/client';
  import { auth } from '$lib/stores/auth.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    userId: string;
    anchorX?: number;
    anchorY?: number;
    onclose?: () => void;
    onmessage?: (userId: string) => void;
  }

  let { userId, anchorX = 0, anchorY = 0, onclose, onmessage }: Props = $props();

  let profile = $state<UserProfile | null>(null);
  let isLoading = $state(true);
  let containerEl = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    api.get<UserProfile>(`/users/${userId}`)
      .then(p => { profile = p; })
      .catch(() => {})
      .finally(() => { isLoading = false; });
  });

  const STATUS_COLORS: Record<UserStatus, string> = {
    [UserStatus.ONLINE]: 'bg-online',
    [UserStatus.OFFLINE]: 'bg-offline',
    [UserStatus.APPEAR_OFFLINE]: 'bg-offline',
    [UserStatus.BUSY]: 'bg-busy',
  };

  const STATUS_LABELS: Record<UserStatus, string> = {
    [UserStatus.ONLINE]: 'Online',
    [UserStatus.OFFLINE]: 'Offline',
    [UserStatus.APPEAR_OFFLINE]: 'Offline',
    [UserStatus.BUSY]: 'Do Not Disturb',
  };

  function formatMemberSince(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function handleMessage() {
    onmessage?.(userId);
    onclose?.();
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      onclose?.();
    }
  }

  $effect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  // Calculate popup position to stay in viewport
  const popupStyle = $derived(() => {
    const w = 288; // popup width
    const h = 360; // approximate popup height
    let x = anchorX;
    let y = anchorY;
    if (typeof window !== 'undefined') {
      if (x + w > window.innerWidth) x = window.innerWidth - w - 8;
      if (y + h > window.innerHeight) y = window.innerHeight - h - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
    }
    return `left: ${x}px; top: ${y}px;`;
  });
</script>

<div
  bind:this={containerEl}
  class="fixed z-50 w-72 rounded-xl bg-bg-floating shadow-2xl border border-divider overflow-hidden"
  style={popupStyle()}
  role="dialog"
  aria-label="User profile"
>
  {#if isLoading}
    <div class="flex items-center justify-center h-40">
      <svg class="animate-spin text-text-muted" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>
  {:else if profile}
    <!-- Banner -->
    <div class="h-16 bg-gradient-to-br from-brand to-brand-hover"></div>

    <!-- Avatar + close -->
    <div class="relative px-4 pb-4">
      <div class="flex items-start justify-between -mt-8">
        <!-- Avatar with status -->
        <div class="relative">
          <div class="rounded-full border-4 border-bg-floating">
            <Avatar src={profile.avatarPath} username={profile.username} size="lg" />
          </div>
          <!-- Status dot -->
          <span
            class="
              absolute bottom-1 right-1
              w-3.5 h-3.5 rounded-full border-2 border-bg-floating
              {STATUS_COLORS[profile.status]}
            "
            aria-label="Status: {STATUS_LABELS[profile.status]}"
          ></span>
        </div>

        <!-- Close button -->
        {#if onclose}
          <button
            onclick={onclose}
            class="mt-2 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Close profile"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        {/if}
      </div>

      <!-- Name & username -->
      <div class="mt-2">
        <h3 class="text-lg font-bold text-text-primary leading-tight">
          {profile.displayName || profile.username}
        </h3>
        <p class="text-sm text-text-secondary">@{profile.username}</p>
        <p class="text-xs text-text-muted mt-0.5">{STATUS_LABELS[profile.status]}</p>
      </div>

      <div class="my-3 border-t border-divider"></div>

      <!-- Member since -->
      <div class="mb-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Member Since</p>
        <p class="text-sm text-text-secondary">{formatMemberSince(profile.createdAt)}</p>
      </div>

      <!-- Roles -->
      {#if profile.roles && profile.roles.length > 0}
        <div class="mb-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1.5">Roles</p>
          <div class="flex flex-wrap gap-1.5">
            {#each profile.roles as role (role.id)}
              <span
                class="flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium border"
                style={role.color
                  ? `background-color: ${role.color}20; border-color: ${role.color}40; color: ${role.color}`
                  : ''}
              >
                {#if role.color}
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {role.color}"></span>
                {/if}
                {role.name}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions -->
      {#if userId !== auth.user?.id}
        <Button variant="primary" size="sm" class="w-full" onclick={handleMessage}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          Message
        </Button>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-center h-40 text-text-muted text-sm">
      Failed to load profile
    </div>
  {/if}
</div>
