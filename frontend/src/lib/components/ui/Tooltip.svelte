<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    children: Snippet;
    class?: string;
  }

  let {
    text,
    position = 'top',
    delay = 500,
    children,
    class: className = '',
  }: Props = $props();

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function show() {
    timer = setTimeout(() => {
      visible = true;
    }, delay);
  }

  function hide() {
    if (timer) clearTimeout(timer);
    timer = null;
    visible = false;
  }

  const positionClasses: Record<NonNullable<Props['position']>, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<NonNullable<Props['position']>, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-bg-floating border-l-transparent border-r-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-bg-floating border-l-transparent border-r-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-bg-floating border-t-transparent border-b-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-bg-floating border-t-transparent border-b-transparent border-l-transparent border-4',
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative inline-flex items-center {className}"
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
>
  {@render children()}

  {#if visible && text}
    <div
      class="
        absolute z-50 pointer-events-none
        {positionClasses[position]}
      "
      role="tooltip"
    >
      <div
        class="
          relative
          bg-bg-floating text-text-primary text-xs font-medium
          px-2 py-1 rounded shadow-lg
          whitespace-nowrap max-w-xs
        "
      >
        {text}
        <!-- Arrow -->
        <span class="absolute {arrowClasses[position]}"></span>
      </div>
    </div>
  {/if}
</div>
