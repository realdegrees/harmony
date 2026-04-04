<script lang="ts">
  import { UserStatus } from '@harmony/shared/types/user';
  import { resolveUploadUrl } from '$lib/utils/tauri';

  interface Props {
    src?: string | null;
    username: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    status?: UserStatus;
    class?: string;
  }

  let {
    src = null,
    username,
    size = 'md',
    status,
    class: className = '',
  }: Props = $props();

  const sizeClasses: Record<NonNullable<Props['size']>, string> = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const statusDotSizes: Record<NonNullable<Props['size']>, string> = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2.5 h-2.5 border-[1.5px]',
    md: 'w-3 h-3 border-2',
    lg: 'w-3.5 h-3.5 border-2',
    xl: 'w-4 h-4 border-2',
  };

  const statusColors: Record<UserStatus, string> = {
    [UserStatus.ONLINE]:         'bg-online shadow-[0_0_6px_rgba(47,182,122,0.6)]',
    [UserStatus.OFFLINE]:        'bg-offline',
    [UserStatus.APPEAR_OFFLINE]: 'bg-offline',
    [UserStatus.BUSY]:           'bg-busy shadow-[0_0_6px_rgba(229,62,68,0.5)]',
  };

  // Deterministic color from username for the fallback circle
  const colors = [
    '#5865f2', '#eb459e', '#ed4245', '#fee75c',
    '#57f287', '#00a8fc', '#faa61a', '#b845f5',
  ];

  function colorFromName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  const initial = $derived(username.charAt(0).toUpperCase());
  const bgColor = $derived(colorFromName(username));
  const resolvedSrc = $derived(resolveUploadUrl(src));
</script>

<div class="relative inline-flex shrink-0 {className}">
  <div
    class="
      {sizeClasses[size]} rounded-full overflow-hidden
      flex items-center justify-center
      font-semibold text-white select-none
    "
    style={!resolvedSrc ? `background-color: ${bgColor}` : undefined}
  >
    {#if resolvedSrc}
      <img
        src={resolvedSrc}
        alt={username}
        class="w-full h-full object-cover"
        draggable="false"
      />
    {:else}
      {initial}
    {/if}
  </div>

  {#if status !== undefined}
    <span
      class="
        absolute bottom-0 right-0
        {statusDotSizes[size]}
        {statusColors[status]}
        rounded-full border-bg-primary
      "
      aria-label="Status: {status.toLowerCase()}"
    ></span>
  {/if}
</div>
