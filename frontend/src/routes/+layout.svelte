<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { channels } from '$lib/stores/channels.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import { presence } from '$lib/stores/presence.svelte';
  import { UserStatus } from '@harmony/shared/types/user';
  import { api } from '$lib/api/client';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { isTauri, getServerUrl } from '$lib/utils/tauri';

  let { children } = $props();

  const authRoutes = ['/login', '/register'];
  const connectRoute = '/connect';

  const isAuthRoute = $derived(authRoutes.some((r) => $page.url.pathname.startsWith(r)));
  const isConnectRoute = $derived($page.url.pathname.startsWith(connectRoute));
  const showAppShell = $derived(auth.isAuthenticated && !isAuthRoute && !isConnectRoute);

  // Tracks whether the post-login data bootstrap has already been fired for
  // the current session. Prevents re-running on every reactive update.
  let bootstrapped = false;

  $effect(() => {
    // In Tauri, redirect to /connect if no server URL is configured yet
    if (isTauri() && !getServerUrl() && !isConnectRoute) {
      goto('/connect');
      return;
    }

    if (!auth.isLoading) {
      if (!auth.isAuthenticated && !isAuthRoute && !isConnectRoute) {
        goto('/login');
      } else if (auth.isAuthenticated && (isAuthRoute || isConnectRoute)) {
        goto('/channels');
      }
    }
  });

  $effect(() => {
    if (auth.isAuthenticated && !bootstrapped) {
      bootstrapped = true;
      channels.fetchChannels().catch(console.error);
      channels.fetchCategories().catch(console.error);
      channels.fetchDmChannels().catch(console.error);
      notifications.fetchNotifications().catch(console.error);
      notifications.fetchUnreadStates().catch(console.error);

      // Seed the presence map with everyone currently online
      api.get<Record<string, string>>('/presence').then((data) => {
        presence.initializeBulk(
          Object.entries(data).map(([userId, status]) => ({
            userId,
            status: status as UserStatus,
          }))
        );
      }).catch(console.error);
    }

    // Reset the flag when the user logs out so the next login re-bootstraps
    if (!auth.isAuthenticated) {
      bootstrapped = false;
    }
  });

  function handleGlobalClick() {
    if (ui.contextMenu) {
      ui.hideContextMenu();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="h-screen flex overflow-hidden" onclick={handleGlobalClick}>
  {#if auth.isLoading}
    <!-- Loading splash -->
    <div class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-brand/20 backdrop-blur-sm border border-brand/30 flex items-center justify-center shadow-[0_0_40px_rgba(92,110,240,0.3)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p class="text-text-muted text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  {:else if showAppShell}
    <Sidebar />
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
      {@render children()}
    </main>
  {:else}
    {@render children()}
  {/if}

  <!-- Global Context Menu -->
  {#if ui.contextMenu?.visible}
    <div
      class="fixed z-[100] bg-white/[0.07] backdrop-blur-2xl rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] border border-white/[0.10] py-1.5 min-w-[180px]"
      style="left: {ui.contextMenu.x}px; top: {ui.contextMenu.y}px;"
      role="menu"
    >
      {#each ui.contextMenu.items as item}
        {#if item.divider}
          <div class="border-t border-divider my-1"></div>
        {:else}
          <button
            class="w-full text-left px-3 py-1.5 text-sm rounded-sm flex items-center gap-2 transition-colors
              {item.danger
                ? 'text-danger hover:bg-danger/15'
                : 'text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'}"
            role="menuitem"
            onclick={() => { item.action(); ui.hideContextMenu(); }}
          >
            {#if item.icon}
              <span class="w-4 h-4 flex-shrink-0">{@html item.icon}</span>
            {/if}
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>
