<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title?: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
    class?: string;
  }

  let {
    open,
    title = '',
    onclose,
    children,
    footer,
    class: className = '',
  }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose?.();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={handleBackdropClick}
  >
    <!-- Dark overlay -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-md"></div>

    <!-- Modal panel -->
    <div
      class="
        relative z-10 w-full max-w-md rounded-2xl
        bg-white/[0.06] backdrop-blur-2xl
        border border-white/[0.10] shadow-[0_32px_80px_rgba(0,0,0,0.6)]
        flex flex-col max-h-[90vh]
        {className}
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <!-- Header -->
      {#if title || onclose}
        <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          {#if title}
            <h2 id="modal-title" class="text-xl font-bold text-text-primary">
              {title}
            </h2>
          {:else}
            <div></div>
          {/if}

          {#if onclose}
            <button
              onclick={onclose}
              class="
                text-text-muted hover:text-text-primary
                transition-colors duration-150
                rounded p-1 hover:bg-bg-hover
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand
              "
              aria-label="Close modal"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Body -->
      <div class="px-6 py-3 overflow-y-auto flex-1">
        {@render children()}
      </div>

      <!-- Footer -->
      {#if footer}
        <div class="px-6 py-4 border-t border-white/[0.07] shrink-0">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
