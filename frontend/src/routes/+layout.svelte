<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { channels } from '$lib/stores/channels.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { isTauri, getServerUrl } from '$lib/utils/tauri';

  let { children } = $props();

  const authRoutes = ['/login', '/register'];
  const connectRoute = '/connect';

  const isAuthRoute = $derived(authRoutes.some((r) => $page.url.pathname.startsWith(r)));
  const isConnectRoute = $derived($page.url.pathname.startsWith(connectRoute));
  const showAppShell = $derived(auth.isAuthenticated && !isAuthRoute && !isConnectRoute);

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
    if (auth.isAuthenticated) {
      channels.fetchChannels().catch(console.error);
      channels.fetchCategories().catch(console.error);
      channels.fetchDmChannels().catch(console.error);
      notifications.fetchNotifications().catch(console.error);
      notifications.fetchUnreadStates().catch(console.error);
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
    <div class="flex-1 flex items-center justify-center bg-bg-primary">
      <div class="flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-brand flex items-center justify-center">
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
      class="fixed z-[100] bg-bg-floating rounded-md shadow-xl border border-white/5 py-1 min-w-[180px]"
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
                ? 'text-danger hover:bg-danger hover:text-white'
                : 'text-text-secondary hover:bg-brand hover:text-white'}"
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
