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
    'inline-flex items-center justify-center font-medium rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:cursor-not-allowed disabled:opacity-50 select-none';

  const variantClasses: Record<NonNullable<Props['variant']>, string> = {
    primary: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
    secondary: 'bg-bg-accent text-text-primary hover:bg-bg-hover active:bg-bg-active',
    danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-800',
    ghost:
      'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary active:bg-bg-active',
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
