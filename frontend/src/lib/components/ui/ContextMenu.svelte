<script lang="ts">
  import type { ContextMenuItem } from '$lib/stores/ui.svelte';

  interface Props {
    items: ContextMenuItem[];
    x: number;
    y: number;
    onclose: () => void;
  }

  let { items, x, y, onclose }: Props = $props();

  let menuEl = $state<HTMLDivElement | null>(null);

  // Adjust position to keep menu within viewport
  let adjustedX = $state(0);
  let adjustedY = $state(0);

  $effect(() => {
    // Initialize from props
    adjustedX = x;
    adjustedY = y;

    if (!menuEl) return;

    const rect = menuEl.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    adjustedX = x + rect.width > vpW ? x - rect.width : x;
    adjustedY = y + rect.height > vpH ? y - rect.height : y;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  function handleOutsideClick(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleOutsideClick} />

<div
  bind:this={menuEl}
  class="
    fixed z-[100]
    bg-white/[0.07] backdrop-blur-2xl border border-white/[0.10]
    rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] py-1.5
    min-w-[160px] max-w-[240px]
    focus:outline-none
  "
  style="left: {adjustedX}px; top: {adjustedY}px;"
  role="menu"
  tabindex="-1"
>
  {#each items as item (item.label)}
    {#if item.type === 'slider'}
      <!-- Slider item — does not close the menu on interaction -->
      <div class="px-3 py-2" role="none">
        <div class="flex items-center justify-between mb-1.5">
          <span class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {#if item.icon}
              <span class="text-sm leading-none" aria-hidden="true">{item.icon}</span>
            {/if}
            {item.label}
          </span>
          <span class="text-xs font-semibold text-text-primary tabular-nums">
            {Math.round(item.value * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={item.min}
          max={item.max}
          step={item.step ?? 0.05}
          value={item.value}
          oninput={(e) => item.onChange(parseFloat((e.target as HTMLInputElement).value))}
          class="w-full h-1.5 rounded-full appearance-none cursor-pointer
                 bg-white/[0.12] accent-brand"
          aria-label={item.label}
        />
        <div class="flex justify-between text-[10px] text-text-muted mt-1">
          <span>{Math.round(item.min * 100)}%</span>
          <span>{Math.round(item.max * 100)}%</span>
        </div>
      </div>
    {:else if item.divider}
      <hr class="my-1.5 border-white/[0.07]" />
    {:else}
      <button
        role="menuitem"
        class="
          w-full flex items-center gap-2.5
          px-3 py-1.5 text-left
          text-sm rounded-lg mx-1
          transition-all duration-100
          focus:outline-none
          {item.danger
            ? 'text-danger hover:bg-danger/15 hover:text-danger'
            : 'text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'}
        "
        style="width: calc(100% - 0.5rem);"
        onclick={() => {
          item.action();
          onclose();
        }}
      >
        {#if item.icon}
          <span class="text-base leading-none shrink-0" aria-hidden="true">{item.icon}</span>
        {/if}
        {item.label}
      </button>
    {/if}
  {/each}
</div>
