import type { Message } from '@harmony/shared/types/message';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  visible: boolean;
}

class UiStore {
  sidebarOpen = $state(true);
  memberListOpen = $state(true);
  activeModal = $state<string | null>(null);
  modalData = $state<unknown>(null);
  contextMenu = $state<ContextMenuState | null>(null);
  replyingTo = $state<Message | null>(null);

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleMemberList(): void {
    this.memberListOpen = !this.memberListOpen;
  }

  openModal(name: string, data?: unknown): void {
    this.activeModal = name;
    this.modalData = data ?? null;
  }

  closeModal(): void {
    this.activeModal = null;
    this.modalData = null;
  }

  showContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
    this.contextMenu = { x, y, items, visible: true };
  }

  hideContextMenu(): void {
    this.contextMenu = null;
  }

  setReplyTo(message: Message): void {
    this.replyingTo = message;
  }

  clearReply(): void {
    this.replyingTo = null;
  }
}

export const ui = new UiStore();
