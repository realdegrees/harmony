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
  import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
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


</script>

<div class="h-screen flex overflow-hidden">
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
    <ContextMenu
      items={ui.contextMenu.items}
      x={ui.contextMenu.x}
      y={ui.contextMenu.y}
      onclose={() => ui.hideContextMenu()}
    />
  {/if}
</div>
