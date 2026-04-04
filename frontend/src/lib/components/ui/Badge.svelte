<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    count: number;
    max?: number;
    children: Snippet;
    class?: string;
  }

  let { count, max = 99, children, class: className = '' }: Props = $props();

  const label = $derived(count > max ? `${max}+` : String(count));
  const show = $derived(count > 0);
</script>

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
