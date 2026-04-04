<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { presence } from '$lib/stores/presence.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { UserStatus } from '@harmony/shared/types/user';
  import type { User } from '@harmony/shared/types/user';

  interface Props {
    members: User[];
  }

  let { members }: Props = $props();

  interface MemberGroups {
    online: User[];
    offline: User[];
  }

  const grouped = $derived<MemberGroups>({
    online: members.filter((m) => {
      const s = presence.getPresence(m.id);
      return s === UserStatus.ONLINE || s === UserStatus.BUSY;
    }),
    offline: members.filter((m) => {
      const s = presence.getPresence(m.id);
      return s === UserStatus.OFFLINE || s === UserStatus.APPEAR_OFFLINE;
    }),
  });

  let selectedMember = $state<User | null>(null);
  let popupPosition = $state({ x: 0, y: 0 });

  function openProfile(e: MouseEvent, member: User) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    popupPosition = { x: rect.left - 250, y: rect.top };
    selectedMember = selectedMember?.id === member.id ? null : member;
  }
</script>

{#if ui.memberListOpen}
  <aside
    class="flex flex-col bg-bg-secondary border-l border-divider shrink-0 overflow-y-auto"
    style="width: var(--member-list-width);"
    aria-label="Member list"
  >
    <div class="py-4">
      <!-- Online members -->
      {#if grouped.online.length > 0}
        <div class="mb-2">
          <p class="px-4 mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Online — {grouped.online.length}
          </p>
          {#each grouped.online as member (member.id)}
            {@const memberStatus = presence.getPresence(member.id)}
            <button
              class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-bg-hover rounded mx-1 transition-colors text-left group"
              style="width: calc(100% - 8px);"
              onclick={(e) => openProfile(e, member)}
              aria-label="View {member.displayName || member.username}'s profile"
            >
              <Avatar
                src={member.avatarPath}
                username={member.displayName || member.username}
                size="sm"
                status={memberStatus}
              />
              <span class="text-sm text-text-secondary group-hover:text-text-primary transition-colors truncate">
                {member.displayName || member.username}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Offline members -->
      {#if grouped.offline.length > 0}
        <div>
          <p class="px-4 mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Offline — {grouped.offline.length}
          </p>
          {#each grouped.offline as member (member.id)}
            <button
              class="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-bg-hover rounded mx-1 transition-colors text-left group opacity-50"
              style="width: calc(100% - 8px);"
              onclick={(e) => openProfile(e, member)}
              aria-label="View {member.displayName || member.username}'s profile"
            >
              <Avatar
                src={member.avatarPath}
                username={member.displayName || member.username}
                size="sm"
                status={UserStatus.OFFLINE}
              />
              <span class="text-sm text-text-muted truncate">
                {member.displayName || member.username}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      {#if members.length === 0}
        <p class="px-4 text-sm text-text-muted text-center mt-4">No members</p>
      {/if}
    </div>
  </aside>
{/if}

<!-- Profile popup -->
{#if selectedMember}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40"
    onclick={() => (selectedMember = null)}
  ></div>
  <div
    class="fixed z-50 bg-bg-floating rounded-lg shadow-2xl border border-white/5 p-4 w-60"
    style="left: {Math.max(8, popupPosition.x)}px; top: {Math.min(popupPosition.y, window.innerHeight - 200)}px;"
    role="dialog"
    aria-label="User profile"
  >
    <div class="flex items-center gap-3 mb-3">
      <Avatar
        src={selectedMember.avatarPath}
        username={selectedMember.displayName || selectedMember.username}
        size="lg"
        status={presence.getPresence(selectedMember.id)}
      />
      <div class="min-w-0">
        <p class="font-semibold text-text-primary truncate">
          {selectedMember.displayName || selectedMember.username}
        </p>
        <p class="text-xs text-text-muted truncate">
          #{selectedMember.username}
        </p>
      </div>
    </div>
    <div class="border-t border-divider pt-3">
      <p class="text-xs text-text-muted">
        Member since {new Date(selectedMember.createdAt).toLocaleDateString()}
      </p>
    </div>
  </div>
{/if}
