# DETAILED UNWIRED FEATURES - FILE REFERENCES & IMPLEMENTATION DETAILS

## SECTION 1: UNUSED FRONTEND COMPONENTS

### 1.1 Tooltip Component
**File:** `/home/fasc/projects/harmony/frontend/src/lib/components/ui/Tooltip.svelte`
**Lines:** 1-82
**Status:** Fully implemented - 82 lines of production-ready code
**Features:**
- Configurable positions: top, bottom, left, right
- Delay before showing (default 500ms)
- Auto-hide on mouse leave / blur
- Styled arrow pointer
- Accessibility role="tooltip"

**Never imported in:** Any .svelte or .ts file
**To implement:** Add imports to buttons, icons, or any component needing hover help text

---

### 1.2 Dropdown Component  
**File:** `/home/fasc/projects/harmony/frontend/src/lib/components/ui/Dropdown.svelte`
**Lines:** 1-154
**Status:** Fully implemented - 154 lines of production-ready code
**Features:**
- Keyboard navigation (arrow keys, escape)
- Click-outside handling
- Disabled options support
- Accessible markup (role="listbox", aria attributes)
- Styled with Tailwind

**Never imported in:** Any .svelte or .ts file
**Alternative usage:** Settings components, role selectors, status menus
**Note:** StatusSelector.svelte implements similar functionality inline instead

---

### 1.3 Badge Component
**File:** `/home/fasc/projects/harmony/frontend/src/lib/components/ui/Badge.svelte`
**Lines:** 1-37
**Status:** Fully implemented - 37 lines
**Features:**
- Overlays count on top-right of content
- Max display limit (default "99+")
- Styled with CSS ring effect
- ARIA label for accessibility

**Currently NOT used but:** Channel list has unread counts inline (could use this component instead)

---

### 1.4 ReactionPicker Component
**File:** `/home/fasc/projects/harmony/frontend/src/lib/components/chat/ReactionPicker.svelte`
**Lines:** 1-103
**Status:** Fully implemented - 103 lines
**Features:**
- Quick reaction buttons (👍 ❤️ 😂 😮 😢 🎉)
- Full emoji picker modal
- Frequent emojis from localStorage
- WebSocket integration (ws.send for reaction:add)
- Handles both unicode and custom emoji IDs

**Currently NOT imported BUT:**
- Similar functionality exists inline in Message.svelte
- Should replace Message.svelte's inline reaction code

**File where it should be used:** `/home/fasc/projects/harmony/frontend/src/lib/components/chat/Message.svelte` (line ~150+ where reactions are rendered)

---

### 1.5 GifPicker Component
**File:** `/home/fasc/projects/harmony/frontend/src/lib/components/chat/GifPicker.svelte`
**Lines:** 1-330
**Status:** Fully implemented - 330 lines
**Features:**
- Trending GIFs tab
- Search with debounce (400ms)
- Favorites management with localStorage
- Infinite scroll pagination
- Responsive grid layout
- API calls to `/api/giphy/trending` and `/api/giphy/search`

**Currently NOT imported in:**
- MessageInput.svelte (where it logically belongs)
- Any other component

**To implement:** Add to MessageInput.svelte as a modal/dropdown option

---

### 1.6 StatusSelector Component
**File:** `/home/fasc/projects/harmony/frontend/src/lib/components/user/StatusSelector.svelte`
**Lines:** 1-128
**Status:** Fully implemented - 128 lines
**Features:**
- Status options: ONLINE, BUSY, APPEAR_OFFLINE, OFFLINE (display only)
- WebSocket integration (ws.send 'presence:update')
- Optimistic local update
- Status indicators with colors
- Menu role for accessibility
- Click outside to close

**Currently NOT imported in:**
- Header.svelte (where user avatar/profile area is)
- Settings.svelte

**To implement:** Show in header as quick access or in user profile menu

---

## SECTION 2: UNUSED UTILITY MODULES

### 2.1 embed.ts
**File:** `/home/fasc/projects/harmony/frontend/src/lib/utils/embed.ts`
**Lines:** 1-150
**Status:** Fully implemented - 150 lines
**Exports:**
```typescript
export function detectEmbeds(content: string): Embed[]
export function isImageUrl(url: string): boolean
export function isGif(url: string): boolean
export function isVideoUrl(url: string): boolean
```

**Features:**
- Regex URL detection (http/https)
- Classifies URLs as: IMAGE, VIDEO, GIF, LINK
- Special handling for: Giphy, Tenor, YouTube
- Strips trailing punctuation

**Currently used in:** NOWHERE
**Should be used in:** 
- MessageList.svelte or Embed.svelte component
- Automatically parse message content and generate embeds

**Related component:** `/home/fasc/projects/harmony/frontend/src/lib/components/chat/Embed.svelte` exists but is never passed data

---

## SECTION 3: BACKEND ENDPOINTS NEVER CALLED FROM FRONTEND

### 3.1 POST /api/auth/logout
**File:** `backend/src/auth/routes.ts:143-145`
**Implementation:** EXISTS (3 lines, returns success)
**Frontend calls:** NONE (frontend just clears tokens locally)
**Status:** Orphaned - backend ready, frontend doesn't call it
**Impact:** Low - stateless auth, no backend action needed

---

### 3.2 POST /api/auth/change-password
**File:** `backend/src/auth/routes.ts`
**Implementation:** MISSING ❌
**Frontend calls:** FOUND in 2 places:
1. `/home/fasc/projects/harmony/frontend/src/lib/components/user/Settings.svelte:~line 60`
   ```svelte
   await api.post('/auth/change-password', { currentPassword, newPassword });
   ```
2. `/home/fasc/projects/harmony/frontend/src/lib/stores/auth.svelte.ts` (referenced)

**Status:** HIGH PRIORITY - Frontend expects it, backend missing
**Required implementation:** Should validate current password and update passwordHash

---

### 3.3 PUT/PATCH /api/users/me/avatar
**File:** `backend/src/users/routes.ts` or `backend/src/media/routes.ts`
**Implementation:** MISSING ❌
**Frontend references:** `/home/fasc/projects/harmony/frontend/src/lib/components/user/Settings.svelte:~line 50`
**Status:** HIGH PRIORITY - Avatar feature incomplete
**Required:** File upload handling, storage integration

---

### 3.4 Role Management Endpoints (ALL 6 UNUSED)
**File:** `backend/src/roles/routes.ts:25-241`
**Endpoints:**
1. GET /api/roles - List all roles (line 25-31)
2. POST /api/roles - Create role (line 37-60)
3. PATCH /api/roles/:id - Update role (line 66-95)
4. DELETE /api/roles/:id - Delete role (line 101-125)
5. POST /api/roles/:id/assign - Assign to user (line 132-160)
6. DELETE /api/roles/:id/assign/:userId - Remove from user (line 167-195)

**Frontend usage:** ZERO
**Status:** Orphaned - Backend fully implemented with permission checks, but no UI exists
**Priority:** MEDIUM - Complete role management feature requires UI implementation

---

### 3.5 GIPHY Favorites Endpoints (3 PARTIALLY UNUSED)
**File:** `backend/src/media/routes.ts:200+`
**Endpoints:**
1. POST /api/giphy/favorites - Save favorite (not called)
2. GET /api/giphy/favorites - List favorites (not called)
3. DELETE /api/giphy/favorites/:id - Remove favorite (not called)

**Frontend:** Stores favorites in localStorage instead
**Files:** `/home/fasc/projects/harmony/frontend/src/lib/utils/local-storage.ts`
**Status:** Orphaned - Backend ready, frontend uses local storage instead
**Priority:** LOW - Works but not synced across devices

---

### 3.6 User Status via REST
**File:** `backend/src/users/routes.ts:150-179`
**Endpoint:** PATCH /api/users/me/status
**Frontend usage:** NOT CALLED (uses WebSocket presence:update instead)
**Status:** Orphaned REST endpoint - WebSocket equivalent works fine

---

## SECTION 4: WEBSOCKET EVENTS NEVER HANDLED

### 4.1 user:updated
**Defined in:** `shared/types/ws-events.ts:229-231`
**Type:**
```typescript
export interface UserUpdatedPayload {
  user: User;
}
export type ServerEvent = ... | { type: 'user:updated'; data: UserUpdatedPayload }
```

**Sent from backend:** Potentially in `backend/src/ws/router.ts` (search for user:updated - NOT FOUND)
**Listened in frontend:** NOWHERE ❌
**Impact:** User profile changes won't propagate to other clients
**Fix location:** Add to `frontend/src/lib/stores/auth.svelte.ts`

---

### 4.2 voice:producer-closed
**Defined in:** `shared/types/ws-events.ts:276`
**Type:**
```typescript
export interface VoiceProducerClosedPayload {
  producerId: string;
}
```

**Sent from backend:** Potentially in media server cleanup code
**Listened in frontend:** NOWHERE ❌
**Impact:** When user stops producing video/audio, UI doesn't update
**Fix location:** Add handler in `frontend/src/lib/stores/voice.svelte.ts`

---

## SECTION 5: WEBSOCKET EVENTS THAT ARE HANDLED ✓

Verified implemented:
- message:new, message:updated, message:deleted
- typing:update
- presence:changed (not presence:update - that's CLIENT->SERVER)
- voice:user-joined, voice:user-left, voice:state-update
- voice:transport-created, voice:produced, voice:new-producer
- voice:consumed
- stream:started, stream:stopped
- soundboard:playing
- notification:new
- channel:created, channel:updated, channel:deleted
- error

---

## SECTION 6: MISSING BACKEND FEATURES

### 6.1 Role Management Admin UI
**What exists:** Full backend role CRUD and assignment API
**What's missing:** Frontend UI to access these endpoints
**Impact:** Admins cannot manage roles through the app
**Required implementation:**
- Admin panel or settings page
- Role list view
- Create/edit/delete role forms
- Assign/remove roles from users

---

## SUMMARY OF RECOMMENDATIONS

### Fix in Next 48 Hours (Blocking):
1. ✅ Implement `POST /api/auth/change-password` 
2. ✅ Implement `POST /api/users/me/avatar`
3. ✅ Add `ws.on('user:updated')` handler
4. ✅ Add `ws.on('voice:producer-closed')` handler

### Nice to Have (This Week):
5. Import Badge component in ChannelList
6. Replace Message.svelte inline reactions with ReactionPicker
7. Add GifPicker to MessageInput
8. Add StatusSelector to Header

### Technical Debt (This Sprint):
9. Implement admin panel with role management
10. Wire GIPHY favorites to backend
11. Integrate embed.ts with message display
12. Use Tooltip/Dropdown where appropriate

---

**Report Generated:** 2026-04-04
**Analysis Tool:** Comprehensive codebase search
**Total Unwired Items:** 20+
