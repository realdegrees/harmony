<script lang="ts">
  import type { GiphyGif } from '@harmony/shared/types/api';
  import { api } from '$lib/api/client';
  import { getFavoriteGifs, saveFavoriteGif, deleteFavoriteGif } from '$lib/utils/local-storage';

  interface Props {
    onselect: (gif: GiphyGif) => void;
    onclose?: () => void;
  }

  let { onselect, onclose }: Props = $props();

  interface FavoriteEntry { giphyId: string; blob: Blob; previewBlob: Blob; }

  let searchQuery = $state('');
  let activeTab = $state<'trending' | 'favorites'>('trending');
  let gifs = $state<GiphyGif[]>([]);
  let favorites = $state<FavoriteEntry[]>([]);
  let favoriteIds = $state<Set<string>>(new Set());
  let isLoading = $state(false);
  let hasMore = $state(false);
  let nextOffset = $state(0);
  let searchTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  let containerEl = $state<HTMLDivElement | undefined>(undefined);
  let scrollEl = $state<HTMLDivElement | undefined>(undefined);

  // Load trending on mount
  $effect(() => {
    loadTrending();
    loadFavorites();
  });

  async function loadTrending() {
    isLoading = true;
    nextOffset = 0;
    try {
      const res = await api.get<{ gifs: GiphyGif[]; next?: string }>('/giphy/trending?limit=20');
      gifs = res.gifs;
      hasMore = !!res.next;
    } catch {
      gifs = [];
    } finally {
      isLoading = false;
    }
  }

  async function loadFavorites() {
    const stored = await getFavoriteGifs();
    favorites = stored;
    favoriteIds = new Set(stored.map(f => f.giphyId));
  }

  async function searchGifs(query: string) {
    if (!query.trim()) {
      loadTrending();
      return;
    }
    isLoading = true;
    nextOffset = 0;
    try {
      const res = await api.get<{ gifs: GiphyGif[]; next?: string }>(
        `/giphy/search?query=${encodeURIComponent(query)}&limit=20&offset=0`
      );
      gifs = res.gifs;
      hasMore = !!res.next;
    } catch {
      gifs = [];
    } finally {
      isLoading = false;
    }
  }

  async function loadMore() {
    if (!hasMore || isLoading) return;
    isLoading = true;
    nextOffset += 20;
    try {
      const path = searchQuery
        ? `/giphy/search?query=${encodeURIComponent(searchQuery)}&limit=20&offset=${nextOffset}`
        : `/giphy/trending?limit=20&offset=${nextOffset}`;
      const res = await api.get<{ gifs: GiphyGif[]; next?: string }>(path);
      gifs = [...gifs, ...res.gifs];
      hasMore = !!res.next;
    } catch {
      hasMore = false;
    } finally {
      isLoading = false;
    }
  }

  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchGifs(searchQuery), 400);
  }

  async function toggleFavorite(gif: GiphyGif) {
    if (favoriteIds.has(gif.id)) {
      await deleteFavoriteGif(gif.id);
    } else {
      // Fetch blobs
      try {
        const [res1, res2] = await Promise.all([
          fetch(gif.url),
          fetch(gif.previewUrl),
        ]);
        const [blob, previewBlob] = await Promise.all([res1.blob(), res2.blob()]);
        await saveFavoriteGif(gif.id, blob, previewBlob);
      } catch {
        // If fetch fails, save with empty blobs
        await saveFavoriteGif(gif.id, new Blob(), new Blob());
      }
    }
    await loadFavorites();
  }

  function handleScroll() {
    if (!scrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      loadMore();
    }
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

  // Split gifs into 2 columns for masonry-like layout
  const col1 = $derived(gifs.filter((_, i) => i % 2 === 0));
  const col2 = $derived(gifs.filter((_, i) => i % 2 === 1));
</script>

<div
  bind:this={containerEl}
  class="flex flex-col w-72 h-96 rounded-lg bg-bg-floating shadow-2xl border border-divider overflow-hidden select-none"
  role="dialog"
  aria-label="GIF picker"
>
  <!-- Search bar -->
  <div class="px-2 pt-2 pb-1 shrink-0">
    <div class="relative">
      <svg
        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      >
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <input
        type="search"
        placeholder="Search GIFs..."
        bind:value={searchQuery}
        oninput={handleSearchInput}
        class="
          w-full pl-8 pr-3 py-1.5 rounded bg-bg-input text-sm
          text-text-primary placeholder:text-text-muted
          border border-transparent focus:border-brand focus:outline-none
        "
        aria-label="Search GIFs"
      />
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 px-2 pb-1 shrink-0">
    <button
      onclick={() => { activeTab = 'trending'; if (!searchQuery) loadTrending(); }}
      class="
        px-3 py-1 rounded text-xs font-medium transition-colors
        {activeTab === 'trending' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
      "
    >
      {searchQuery ? 'Results' : 'Trending'}
    </button>
    <button
      onclick={() => activeTab = 'favorites'}
      class="
        px-3 py-1 rounded text-xs font-medium transition-colors
        {activeTab === 'favorites' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
      "
    >
      Favorites {favorites.length > 0 ? `(${favorites.length})` : ''}
    </button>
  </div>

  <!-- GIF grid -->
  <div
    bind:this={scrollEl}
    onscroll={handleScroll}
    class="flex-1 overflow-y-auto px-2 pb-2"
  >
    {#if activeTab === 'favorites'}
      {#if favorites.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-text-muted text-sm">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="mb-2 opacity-50" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <p>No favorites yet</p>
          <p class="text-xs mt-1">Heart a GIF to save it</p>
        </div>
      {:else}
        <div class="flex gap-1.5 mt-1">
          <div class="flex flex-col gap-1.5 flex-1">
            {#each favorites.filter((_, i) => i % 2 === 0) as fav (fav.giphyId)}
              <div class="relative group rounded overflow-hidden cursor-pointer">
                <img
                  src={URL.createObjectURL(fav.previewBlob)}
                  alt="Favorite GIF"
                  class="w-full object-cover rounded"
                  onclick={() => onselect({ id: fav.giphyId, title: '', url: URL.createObjectURL(fav.blob), previewUrl: URL.createObjectURL(fav.previewBlob), width: 0, height: 0 })}
                />
                <button
                  onclick={() => deleteFavoriteGif(fav.giphyId).then(loadFavorites)}
                  class="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove from favorites"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
          <div class="flex flex-col gap-1.5 flex-1">
            {#each favorites.filter((_, i) => i % 2 === 1) as fav (fav.giphyId)}
              <div class="relative group rounded overflow-hidden cursor-pointer">
                <img
                  src={URL.createObjectURL(fav.previewBlob)}
                  alt="Favorite GIF"
                  class="w-full object-cover rounded"
                  onclick={() => onselect({ id: fav.giphyId, title: '', url: URL.createObjectURL(fav.blob), previewUrl: URL.createObjectURL(fav.previewBlob), width: 0, height: 0 })}
                />
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      {#if isLoading && gifs.length === 0}
        <div class="flex items-center justify-center h-full text-text-muted text-sm">
          <svg class="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Loading...
        </div>
      {:else if gifs.length === 0}
        <p class="text-center text-text-muted text-sm py-8">No GIFs found</p>
      {:else}
        <!-- Masonry 2-column layout -->
        <div class="flex gap-1.5 mt-1">
          <div class="flex flex-col gap-1.5 flex-1">
            {#each col1 as gif (gif.id)}
              <div class="relative group rounded overflow-hidden cursor-pointer">
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  class="w-full object-cover rounded hover:opacity-90 transition-opacity"
                  onclick={() => onselect(gif)}
                />
                <!-- Favorite button -->
                <button
                  onclick={(e) => { e.stopPropagation(); toggleFavorite(gif); }}
                  class="
                    absolute top-1 right-1 p-1 rounded-full bg-black/60
                    opacity-0 group-hover:opacity-100 transition-opacity
                    {favoriteIds.has(gif.id) ? 'text-red-400' : 'text-white'}
                  "
                  aria-label={favoriteIds.has(gif.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={favoriteIds.has(gif.id) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
          <div class="flex flex-col gap-1.5 flex-1">
            {#each col2 as gif (gif.id)}
              <div class="relative group rounded overflow-hidden cursor-pointer">
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  class="w-full object-cover rounded hover:opacity-90 transition-opacity"
                  onclick={() => onselect(gif)}
                />
                <button
                  onclick={(e) => { e.stopPropagation(); toggleFavorite(gif); }}
                  class="
                    absolute top-1 right-1 p-1 rounded-full bg-black/60
                    opacity-0 group-hover:opacity-100 transition-opacity
                    {favoriteIds.has(gif.id) ? 'text-red-400' : 'text-white'}
                  "
                  aria-label={favoriteIds.has(gif.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={favoriteIds.has(gif.id) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        </div>

        {#if isLoading}
          <div class="flex justify-center py-3">
            <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <!-- Giphy attribution -->
  <div class="shrink-0 px-3 py-1.5 border-t border-divider flex items-center justify-end">
    <span class="text-[10px] text-text-muted">Powered by GIPHY</span>
  </div>
</div>
