<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    count: number;
    max?: number;
    children?: Snippet;
    class?: string;
  }

  let { count, max = 99, children, class: className = '' }: Props = $props();

  const label = $derived(count > max ? `${max}+` : String(count));
  const show = $derived(count > 0);
</script>

{#if children}
  <div class="relative inline-flex {className}">
    {@render children()}
    {#if show}
      <span
        class="
          absolute -top-1 -right-1
          min-w-[18px] h-[18px] px-1
          bg-danger text-white
          text-[11px] font-bold leading-none
          rounded-full
          flex items-center justify-center
          pointer-events-none select-none
          ring-2 ring-bg-secondary
        "
        aria-label="{count} unread"
      >
        {label}
      </span>
    {/if}
  </div>
{:else if show}
  <span
    class="
      min-w-[18px] h-[18px] px-1
      bg-brand text-white
      text-[10px] font-bold leading-none
      rounded-full
      flex items-center justify-center
      shrink-0 select-none
      shadow-[0_0_8px_rgba(92,110,240,0.5)]
      {className}
    "
    aria-label="{count} unread"
  >
    {label}
  </span>
{/if}
