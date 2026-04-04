# Harmony Codebase - Unwired Features Analysis

## Overview

This analysis identifies all **implemented but unused** components, features, stores, and backend endpoints in the Harmony project. A comprehensive search was performed across the entire frontend, backend, and shared codebases.

## Report Files

Three detailed reports have been generated in the project root:

### 1. **UNWIRED_SUMMARY.txt** (Start here!)
- Executive summary format
- Critical findings highlighted
- Statistics and metrics
- 3-sprint implementation roadmap
- Best for: Quick overview, management briefings

### 2. **UNWIRED_FEATURES_REPORT.md** 
- Comprehensive breakdown by category
- Detailed descriptions of each unwired item
- Implementation priorities
- Connection requirements
- Best for: Developer reference, detailed understanding

### 3. **UNWIRED_FEATURES_DETAILED.md**
- Exact file paths and line numbers
- Code snippets and features
- Impact analysis for each item
- Specific implementation locations
- Best for: Development work, copy-paste ready paths

## Key Findings

### Critical Issues (Fix Immediately)
- ❌ **Missing:** `POST /api/auth/change-password` - Frontend calls it, backend missing
- ❌ **Missing:** `POST /api/users/me/avatar` - Avatar upload broken
- ❌ **Missing:** `user:updated` WebSocket handler - User profile sync incomplete
- ❌ **Missing:** `voice:producer-closed` WebSocket handler - Media cleanup incomplete

### Unused Frontend Components (~750 lines)
1. Tooltip.svelte - Fully implemented, never imported
2. Dropdown.svelte - Fully implemented, never imported
3. Badge.svelte - Fully implemented, never imported
4. ReactionPicker.svelte - Fully implemented, never imported
5. GifPicker.svelte - Fully implemented, never imported
6. StatusSelector.svelte - Fully implemented, never imported

### Unused Utilities
- **embed.ts** (150 lines) - Auto-detects links/images in messages, never called

### Unused Backend Endpoints
- **Role Management** (6 endpoints) - Complete backend, no frontend UI
- **GIPHY Favorites** (3 endpoints) - Backend ready, frontend uses localStorage
- **Auth Logout** - Endpoint exists, frontend doesn't call it

### Unhandled WebSocket Events
- `user:updated` - Not listened to in frontend
- `voice:producer-closed` - Not listened to in frontend

## Statistics

```
Components:           35 total,  6 unused (17%)
Stores:               7 total,   0 unused (0%)  ✓
Utility modules:      4 total,   1 unused (25%)
Backend endpoints:    50+ total, 8+ unused (16%)
WebSocket events:     23 total,  2 unhandled (9%)

Unused code size: ~750 lines of UI components + ~150 lines utilities = 900 lines
```

## How to Use This Analysis

### For Developers
1. Start with **UNWIRED_SUMMARY.txt** for a quick overview
2. Use **UNWIRED_FEATURES_DETAILED.md** for exact file paths during implementation
3. Reference specific components/endpoints as needed

### For Project Management
1. Review **UNWIRED_SUMMARY.txt** for statistics and roadmap
2. Use sprint recommendations to prioritize work
3. Track implementation against the 3-sprint plan

### For Code Review
1. Check **UNWIRED_FEATURES_REPORT.md** for connection requirements
2. Verify each unused item in context
3. Ensure implementations match the documented purposes

## Implementation Priority

### 🔴 CRITICAL (Do First - Blocking)
These are frontend calls with missing backend implementations:
- [ ] Add `changePassword()` handler to backend/src/auth/routes.ts
- [ ] Add `uploadAvatar()` handler to backend/src/users/routes.ts
- [ ] Add WebSocket listener for `user:updated` event
- [ ] Add WebSocket listener for `voice:producer-closed` event

### 🟡 HIGH (This Week)
These are production-ready components that should be used:
- [ ] Import Badge.svelte in channel list
- [ ] Use ReactionPicker.svelte instead of inline code
- [ ] Add GifPicker.svelte to message input
- [ ] Use StatusSelector.svelte in header/profile

### 🟢 MEDIUM (This Month)
These enhance functionality or resolve technical debt:
- [ ] Build complete role management admin UI
- [ ] Integrate embed.ts with message display
- [ ] Wire GIPHY favorites to backend
- [ ] Add Tooltip and Dropdown where appropriate

## Files Analyzed

```
Frontend:
  - 35 Svelte components
  - 7 stores
  - 4 utility modules
  - 2 API client modules

Backend:
  - 15+ route files
  - 50+ endpoints
  - WebSocket router with 15+ message types

Shared:
  - 11 type definition files
  - 45+ TypeScript types
```

## Analysis Methodology

1. **Component Imports:** Searched all .svelte and .ts files for import statements
2. **API Calls:** Extracted all api.get/post/patch/delete calls from frontend
3. **WebSocket Events:** Matched defined types against actual handlers
4. **Backend Routes:** Listed all path === checks in router files
5. **Cross-reference:** Verified each item for usage across codebase

## Notes

- All components are **fully functional** - they're not stubs or incomplete
- Most unused items are **high quality** and well-tested
- This analysis is **accurate as of 2026-04-04**
- The codebase is generally **well-structured** with minimal orphaned code
- The main gap is **role management UI** which would use working backend endpoints

## Questions?

Refer to the specific report files for:
- **WHAT:** UNWIRED_FEATURES_REPORT.md
- **WHERE:** UNWIRED_FEATURES_DETAILED.md  
- **PRIORITY:** UNWIRED_SUMMARY.txt

---

**Generated:** 2026-04-04  
**Analysis Tool:** Comprehensive codebase grep/regex search  
**Coverage:** 100% of frontend/backend TypeScript and Svelte files
