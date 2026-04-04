import type { Role } from './role.ts';

export enum UserStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  APPEAR_OFFLINE = 'APPEAR_OFFLINE',
  BUSY = 'BUSY',
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  roles: Role[];
}
