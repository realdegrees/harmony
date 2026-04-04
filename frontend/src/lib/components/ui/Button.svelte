<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    class?: string;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    type = 'button',
    onclick,
    children,
    class: className = '',
  }: Props = $props();

  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-40 select-none';

  const variantClasses: Record<NonNullable<Props['variant']>, string> = {
    primary:
      'bg-brand text-white hover:bg-brand-hover active:bg-brand-active shadow-[0_2px_16px_rgba(92,110,240,0.35)] hover:shadow-[0_2px_24px_rgba(92,110,240,0.5)]',
    secondary:
      'bg-white/[0.07] text-text-primary border border-white/[0.08] hover:bg-white/[0.11] active:bg-white/[0.05] backdrop-blur-sm',
    danger:
      'bg-danger/90 text-white hover:bg-danger active:bg-red-700 shadow-[0_2px_12px_rgba(229,62,68,0.3)]',
    ghost:
      'bg-transparent text-text-secondary hover:bg-white/[0.06] hover:text-text-primary active:bg-white/[0.04]',
  };

  const sizeClasses: Record<NonNullable<Props['size']>, string> = {
    sm: 'h-7 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-sm gap-2',
    lg: 'h-11 px-6 text-base gap-2.5',
  };
</script>

<button
  {type}
  class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {className}"
  disabled={disabled || loading}
  {onclick}
>
  {#if loading}
    <svg
      class="animate-spin"
      style="width: 1em; height: 1em;"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      ></path>
    </svg>
  {/if}
  {@render children()}
</button>
