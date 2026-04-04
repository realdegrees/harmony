<script lang="ts">
  import type { SearchFilters } from '@harmony/shared/types/message';
  import { api } from '$lib/api/client';

  interface Props {
    onsearch: (filters: SearchFilters) => void;
  }

  let { onsearch }: Props = $props();

  let isExpanded = $state(false);
  let inputValue = $state('');
  let isSearching = $state(false);
  let inputEl = $state<HTMLInputElement | undefined>(undefined);

  // Active filter chips
  interface FilterChip {
    key: keyof SearchFilters;
    label: string;
    value: string;
  }

  let chips = $state<FilterChip[]>([]);
  let showSuggestions = $state(false);
  let suggestions = $state<{ type: 'user' | 'channel'; id: string; label: string }[]>([]);
  let pendingFilterKey = $state<'from' | 'in' | null>(null);
  let suggestionTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  // Filter prefix detection
  const FILTER_PREFIXES = [
    { prefix: 'from:', key: 'authorId' as const, label: 'From' },
    { prefix: 'in:', key: 'channelId' as const, label: 'In' },
    { prefix: 'has:image', key: 'hasImage' as const, label: 'Has image', boolean: true },
    { prefix: 'has:link', key: 'hasLink' as const, label: 'Has link', boolean: true },
    { prefix: 'has:attachment', key: 'hasAttachment' as const, label: 'Has attachment', boolean: true },
    { prefix: 'before:', key: 'before' as const, label: 'Before' },
    { prefix: 'after:', key: 'after' as const, label: 'After' },
  ];

  function expand() {
    isExpanded = true;
    setTimeout(() => inputEl?.focus(), 50);
  }

  function collapse() {
    if (!inputValue && chips.length === 0) {
      isExpanded = false;
    }
  }

  async function fetchSuggestions(query: string, type: 'user' | 'channel') {
    try {
      if (type === 'user') {
        const res = await api.get<{ id: string; username: string; displayName: string }[]>(
          `/users/search?q=${encodeURIComponent(query)}&limit=5`
        );
        suggestions = res.map(u => ({ type: 'user', id: u.id, label: u.displayName || u.username }));
      } else {
        const res = await api.get<{ id: string; name: string }[]>(
          `/channels/search?q=${encodeURIComponent(query)}&limit=5`
        );
        suggestions = res.map(c => ({ type: 'channel', id: c.id, label: `#${c.name}` }));
      }
      showSuggestions = suggestions.length > 0;
    } catch {
      suggestions = [];
      showSuggestions = false;
    }
  }

  function handleInput() {
    const val = inputValue.trim();

    // Check for filter prefixes
    for (const fp of FILTER_PREFIXES) {
      if (val.toLowerCase() === fp.prefix.toLowerCase() && (fp as { boolean?: boolean }).boolean) {
        // Instant boolean chip
        addChip({ key: fp.key, label: fp.label, value: 'true' });
        inputValue = '';
        return;
      }
      if (val.toLowerCase().startsWith(fp.prefix.toLowerCase())) {
        const afterPrefix = val.slice(fp.prefix.length);
        if (fp.key === 'authorId') {
          pendingFilterKey = 'from';
          if (suggestionTimer) clearTimeout(suggestionTimer);
          suggestionTimer = setTimeout(() => fetchSuggestions(afterPrefix, 'user'), 300);
          return;
        }
        if (fp.key === 'channelId') {
          pendingFilterKey = 'in';
          if (suggestionTimer) clearTimeout(suggestionTimer);
          suggestionTimer = setTimeout(() => fetchSuggestions(afterPrefix, 'channel'), 300);
          return;
        }
      }
    }

    pendingFilterKey = null;
    showSuggestions = false;
  }

  function addChip(chip: FilterChip) {
    // Remove existing chip with same key
    chips = [...chips.filter(c => c.key !== chip.key), chip];
    inputValue = '';
    pendingFilterKey = null;
    showSuggestions = false;
  }

  function removeChip(key: keyof SearchFilters) {
    chips = chips.filter(c => c.key !== key);
  }

  function selectSuggestion(suggestion: { type: 'user' | 'channel'; id: string; label: string }) {
    if (pendingFilterKey === 'from') {
      addChip({ key: 'authorId', label: `From: ${suggestion.label}`, value: suggestion.id });
    } else if (pendingFilterKey === 'in') {
      addChip({ key: 'channelId', label: `In: ${suggestion.label}`, value: suggestion.id });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      doSearch();
    } else if (e.key === 'Escape') {
      showSuggestions = false;
      isExpanded = false;
    } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      chips = chips.slice(0, -1);
    }
  }

  function doSearch() {
    if (!inputValue.trim() && chips.length === 0) return;

    isSearching = true;
    const filters: SearchFilters = { query: inputValue.trim() };

    for (const chip of chips) {
      if (chip.key === 'hasImage') filters.hasImage = true;
      else if (chip.key === 'hasLink') filters.hasLink = true;
      else if (chip.key === 'hasAttachment') filters.hasAttachment = true;
      else if (chip.key === 'authorId') filters.authorId = chip.value;
      else if (chip.key === 'channelId') filters.channelId = chip.value;
      else if (chip.key === 'before') filters.before = chip.value;
      else if (chip.key === 'after') filters.after = chip.value;
    }

    onsearch(filters);
    isSearching = false;
    showSuggestions = false;
  }

  function clearAll() {
    inputValue = '';
    chips = [];
    showSuggestions = false;
  }

  let containerEl = $state<HTMLDivElement | undefined>(undefined);

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      showSuggestions = false;
      collapse();
    }
  }

  $effect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });
</script>

<div bind:this={containerEl} class="relative">
  <!-- Search field -->
  <div
    class="
      flex items-center gap-1.5 px-2.5 rounded
      bg-bg-input border border-transparent
      transition-all duration-150 cursor-text
      {isExpanded ? 'border-brand w-72' : 'w-36 hover:border-divider'}
    "
    onclick={expand}
    role="searchbox"
    aria-label="Search messages"
    aria-expanded={isExpanded}
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') expand(); }}
  >
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
      class="text-text-muted shrink-0" aria-hidden="true"
    >
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>

    <!-- Filter chips -->
    {#each chips as chip (chip.key)}
      <span
        class="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-brand/20 text-brand text-xs whitespace-nowrap shrink-0"
      >
        {chip.label}
        <button
          onclick={(e) => { e.stopPropagation(); removeChip(chip.key); }}
          class="hover:text-white transition-colors"
          aria-label="Remove filter"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </span>
    {/each}

    <input
      bind:this={inputEl}
      bind:value={inputValue}
      type="search"
      placeholder={isExpanded ? 'Search... (from: in: has:image)' : 'Search'}
      class="
        flex-1 min-w-0 bg-transparent text-sm text-text-primary
        placeholder:text-text-muted focus:outline-none py-1.5
      "
      oninput={handleInput}
      onkeydown={handleKeydown}
      aria-label="Search input"
    />

    <!-- Clear / searching indicator -->
    {#if isSearching}
      <svg class="animate-spin shrink-0 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    {:else if inputValue || chips.length > 0}
      <button
        onclick={(e) => { e.stopPropagation(); clearAll(); }}
        class="text-text-muted hover:text-text-primary transition-colors shrink-0"
        aria-label="Clear search"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    {/if}
  </div>

  <!-- Autocomplete suggestions dropdown -->
  {#if showSuggestions && suggestions.length > 0}
    <div
      class="
        absolute top-full mt-1 left-0 right-0 z-50
        bg-bg-floating border border-divider rounded-lg shadow-xl
        overflow-hidden py-1
      "
      role="listbox"
      aria-label="Suggestions"
    >
      {#each suggestions as suggestion (suggestion.id)}
        <button
          onclick={() => selectSuggestion(suggestion)}
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left"
          role="option"
          aria-selected="false"
        >
          {#if suggestion.type === 'user'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-text-muted shrink-0" aria-hidden="true">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-text-muted shrink-0" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          {/if}
          <span class="truncate">{suggestion.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
