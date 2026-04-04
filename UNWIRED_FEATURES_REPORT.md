# COMPREHENSIVE UNWIRED/ORPHANED FEATURES ANALYSIS

## 1. FRONTEND COMPONENTS (NEVER IMPORTED)

### Fully Implemented but Unused:
1. **Tooltip.svelte** (/home/fasc/projects/harmony/frontend/src/lib/components/ui/Tooltip.svelte)
   - Status: Fully implemented with hover/focus detection, positioning, and arrow styling
   - Purpose: Display hover tooltips with configurable position and delay
   - Needs: Import in components that need tooltips (e.g., buttons, icons)
   
2. **Dropdown.svelte** (/home/fasc/projects/harmony/frontend/src/lib/components/ui/Dropdown.svelte)
   - Status: Fully implemented with keyboard navigation (arrow keys, escape), click outside handling
   - Purpose: Reusable dropdown/select component with accessible markup
   - Needs: Import in forms or settings where dropdowns are needed
   
3. **Badge.svelte** (/home/fasc/projects/harmony/frontend/src/lib/components/ui/Badge.svelte)
   - Status: Fully implemented with max count display (e.g., "99+")
   - Purpose: Display notification/unread badges overlaid on content
   - Needs: Import in channel list or notification components (Badge component exists but Channel list uses inline styling instead)
   
4. **ReactionPicker.svelte** (/home/fasc/projects/harmony/frontend/src/lib/components/chat/ReactionPicker.svelte)
   - Status: Fully implemented with quick reactions (👍 ❤️ 😂 😮 😢 🎉) and full emoji picker modal
   - Purpose: Allow users to add reactions to messages
   - Needs: Import and use in Message.svelte component (currently reactions use inline code in Message.svelte instead)
   
5. **GifPicker.svelte** (/home/fasc/projects/harmony/frontend/src/lib/components/chat/GifPicker.svelte)
   - Status: Fully implemented with trending GIFs, search, favorites, pagination
   - Purpose: GIF selection interface with local storage for favorites
   - Needs: Integration into message input UI
   
6. **StatusSelector.svelte** (/home/fasc/projects/harmony/frontend/src/lib/components/user/StatusSelector.svelte)
   - Status: Fully implemented with status options (ONLINE, BUSY, APPEAR_OFFLINE) and WebSocket integration
   - Purpose: User status selection dropdown
   - Needs: Import in user profile/header area for quick status change

### Status of similar functionality:
- Reactions ARE implemented via inline code in Message.svelte (uses EmojiPicker directly)
- GifPicker IS implemented but never used in MessageInput

---

## 2. UTILITY MODULES (NEVER USED)

### embed.ts (/home/fasc/projects/harmony/frontend/src/lib/utils/embed.ts)
- Status: Fully implemented with:
  - URL detection in message content
  - Image, video, GIF, YouTube, and generic link classification
  - Functions: detectEmbeds(), isImageUrl(), isGif(), isVideoUrl()
- Purpose: Parse message content for embeddable URLs
- Needs: Integration into Embed.svelte or MessageList to automatically parse links in messages
- Note: Embed.svelte component exists but is never called with data from this utility

---

## 3. BACKEND API ENDPOINTS (NEVER CALLED FROM FRONTEND)

### Authentication Endpoints:
1. **POST /api/auth/logout**
   - Status: Implemented in backend/src/auth/routes.ts
   - Frontend call: MISSING (frontend just clears tokens locally)
   - Impact: Stateless implementation, no backend action needed, but endpoint exists unused

2. **POST /api/auth/change-password**
   - Status: NOT IMPLEMENTED in backend
   - Frontend call: FOUND in Settings.svelte and auth.svelte.ts
   - Impact: Backend needs to implement this endpoint
   - Location needed: backend/src/auth/routes.ts

3. **PUT/PATCH /api/users/me/avatar**
   - Status: NOT IMPLEMENTED in backend
   - Frontend call: FOUND as /users/me/avatar reference
   - Impact: Avatar upload functionality is missing
   - Location needed: backend/src/users/routes.ts or backend/src/media/routes.ts

### Role Management Endpoints (ALL UNUSED):
All of these exist in backend/src/roles/routes.ts but have NO frontend calls:
1. **GET /api/roles** - List all roles
2. **POST /api/roles** - Create role
3. **PATCH /api/roles/:id** - Update role
4. **DELETE /api/roles/:id** - Delete role
5. **POST /api/roles/:id/assign** - Assign role to user
6. **DELETE /api/roles/:id/assign/:userId** - Remove role from user
- Status: Fully implemented with permission checks
- Frontend: Completely missing role management UI
- Impact: Role editing UI needs to be implemented

### User Profile Endpoints (PARTIALLY UNUSED):
1. **GET /api/users/:id** - Get user profile by ID
   - Status: Implemented in backend
   - Frontend call: FOUND in UserProfile.svelte
   - Status: USED

2. **GET /api/users/search?q=...** - Search users
   - Status: Implemented in backend
   - Frontend call: FOUND in SearchBar.svelte
   - Status: USED

3. **PATCH /api/users/me/status** - Update user status
   - Status: Implemented in backend
   - Frontend call: NOT FOUND (presence:update sent via WebSocket instead)
   - Note: Status is changed via WS event 'presence:update', but endpoint exists for REST

### Media/GIF Endpoints (PARTIALLY UNUSED):
1. **GET /api/giphy/favorites** - Get favorite GIFs
   - Status: Implemented in backend
   - Frontend call: NOT FOUND (stored in localStorage instead)
   - Impact: Backend GIPHY favorites sync not wired

2. **DELETE /api/giphy/favorites/:id** - Remove favorite GIF
   - Status: Implemented in backend
   - Frontend call: NOT FOUND
   - Impact: Backend GIPHY favorites sync not wired

3. **POST /api/giphy/favorites** - Add favorite GIF
   - Status: Implemented in backend
   - Frontend call: NOT FOUND
   - Impact: Backend GIPHY favorites sync not wired

### Soundboard Endpoints (PARTIALLY UNUSED):
- Sound endpoints exist in backend/src/media/routes.ts
- Frontend only sends ws.send('soundboard:play') messages
- REST endpoints for getting server/user sounds: FOUND CALLS
- Status: Partially wired through WebSocket

### Attachment Upload Endpoint:
1. **POST /api/attachments** - Create pending attachment
   - Status: Implemented in backend
   - Frontend call: FOUND in MessageInput.svelte context
   - Status: Likely USED

---

## 4. WEBSOCKET EVENTS (SERVER EVENTS NEVER LISTENED TO)

### Defined in shared/types/ws-events.ts but NOT handled in frontend:

1. **user:updated**
   - ServerEvent type: { type: 'user:updated'; data: UserUpdatedPayload }
   - Purpose: Notify clients when user profile changes (e.g., status, avatar)
   - Currently: Backend can send it, but no frontend listener
   - Impact: User profile changes won't be reflected for other clients
   - Needs: ws.on<UserUpdatedPayload>('user:updated', ...) in appropriate store

2. **voice:producer-closed**
   - ServerEvent type: { type: 'voice:producer-closed'; data: VoiceProducerClosedPayload }
   - Purpose: Notify when a user stops producing audio/video
   - Currently: Backend defined but no frontend listener
   - Impact: Clients won't be notified when others stop sharing media
   - Needs: Handler in voice.svelte.ts to clean up remote streams

### Analysis of handled server events:
✓ message:new, message:updated, message:deleted
✓ typing:update
✓ presence:changed
✓ voice:user-joined, voice:user-left, voice:state-update, voice:transport-created, voice:produced, voice:new-producer, voice:consumed
✓ stream:started, stream:stopped
✓ soundboard:playing
✓ notification:new
✓ channel:created, channel:updated, channel:deleted
✗ user:updated (NOT HANDLED)
✗ voice:producer-closed (NOT HANDLED)

---

## 5. WEBSOCKET CLIENT EVENTS (NEVER SENT FROM FRONTEND)

All client events defined appear to be sent from somewhere.
✓ All ClientEvent types have implementations

---

## 6. SHARED TYPES (POTENTIALLY UNUSED)

### Notification types:
- Fully used in stores and components

### Voice types:
- Fully used in voice components and stores

### Message types (Embed):
- Embed type is defined but detectEmbeds() utility is never called
- Embed.svelte component exists but never populated with auto-detected embeds

---

## SUMMARY TABLE

| Category | Count | Status |
|----------|-------|--------|
| Unused Components | 6 | Fully implemented, never imported |
| Unused Utilities | 1 | Fully implemented (embed.ts) |
| Unused Backend Endpoints | 8+ | Fully/partially implemented |
| Unused WebSocket Events | 2 | Defined but not handled |
| Missing Backend Endpoints | 2 | Frontend calls but backend missing |
| Missing Frontend Features | 1 | Role management UI |

---

## PRIORITY FIX LIST

### High Priority:
1. **Implement /api/auth/change-password** in backend (frontend already calls it)
2. **Implement /api/users/me/avatar** upload endpoint in backend
3. **Add ws.on('user:updated')** handler in frontend for user profile sync
4. **Add ws.on('voice:producer-closed')** handler in frontend for proper media cleanup

### Medium Priority:
5. Import and use Tooltip, Badge components where appropriate
6. Import and use ReactionPicker for dedicated reaction UI
7. Wire up user:updated event from backend
8. Implement role management UI (currently all role endpoints are orphaned)

### Low Priority:
9. Wire up GIPHY favorites to backend instead of localStorage
10. Import Dropdown component for future use
11. Use GifPicker in message input
12. Integrate embed detection utility with Embed component

