# My Schedule (client) declutter — Design

**Date:** 2026-07-10
**Screen:** `frontend/app/my-schedule.tsx` (client-only)

## Problem

The client My Schedule screen stacks four utility cards above the actual
content. From top to bottom today:

1. Check-in code card ("Generate check-in code")
2. Reminders card (notifications toggle)
3. Connect-trainer card (invite-code input + "your trainers" list)
4. My-packs card (remaining package sessions — only when packs exist)
5. …then the sessions list

The two things a client opens this screen for — their sessions and their
remaining package — are buried under three setup/utility cards.

## Goal

Promote sessions + package to the top of the body; move the two "setup"
utilities (reminders, connect-trainer) into a top-right ⋮ overflow menu. Leave
check-in code generation on the screen.

## Design

### Header (new)

`my-schedule` uses the native stack header (`title: "My Schedule"` in
`app/_layout.tsx`). Add a ⋮ button via `headerRight` that toggles a
`menuVisible` state and opens the existing **`ProfileMenuModal`**
(`src/components/ProfileMenuModal.tsx`) — it already renders as a top-right
dropdown overlay and supports a per-item `trailing` node.

Menu items (`ProfileMenuItem[]`):

- **Reminders** — `icon: "notifications-outline"`, `trailing: <Switch>` bound to
  the existing `remindersOn` value and `onToggleReminders` handler. Toggling
  happens inline in the row; the menu stays open. `disabled`/`loading` reflect
  `savingReminders`.
- **Connect a trainer** — `icon: "person-add-outline"`, `onPress` closes the menu
  and opens the connect-trainer sheet (below).

### Connect-trainer sheet

A `Modal` (kept inline in the screen unless the file feels crowded) holding the
existing pieces, moved verbatim:

- Invite-code `TextInput` (`trainerCode` state) + connect button (`redeemInvite`).
- "Your trainers" list (`myTrainers`) with rows that navigate to
  `/trainers/[id]`.

All existing state/hooks (`trainerCode`, `useRedeemTrainerInviteMutation`,
`useGetMyTrainersQuery`) stay in the screen. No logic changes — only relocation.

### Body (reordered)

The FlatList `ListHeaderComponent` shrinks to two cards:

1. **Check-in code** card — unchanged, stays topmost.
2. **Session package** card — promoted from position 4. Renders only when
   `myPacks.length > 0` (unchanged behavior). No placeholder when empty.

Then the sessions list (`renderItem`) and `ListEmptyComponent` are unchanged.

The reminders card and connect-trainer card are **removed** from the body.

### What does NOT change

- Backend / API: none. Same RTK Query hooks.
- Session card rendering, cancel-booking flow, check-in code generation logic.
- The onboarding tour targets: `client-code-card` still wraps the check-in code
  card; `client-schedule-list` still wraps the first session card. (The
  connect-trainer/reminders cards had no tour targets, so moving them is safe.)

## Components touched

| File | Change |
|------|--------|
| `frontend/app/my-schedule.tsx` | Add header ⋮ + `ProfileMenuModal`; move reminders → menu row (inline Switch); move connect-trainer → Modal; reorder body to code → package → sessions; remove the two relocated cards from the body. |
| `frontend/src/components/ProfileMenuModal.tsx` | Reused as-is (no change expected). |

No new dependencies. i18n keys already exist (`remindersTitle`,
`inviteEnterTitle`, etc.); reuse them.

## Testing

Manual, on a client account:
- ⋮ appears in the header; opens the dropdown top-right.
- Reminders switch in the menu toggles push permission + persists (off→on prompts,
  on→off disables), matching current behavior.
- "Connect a trainer" opens the sheet; redeeming a valid code connects and lists
  the trainer; invalid code shows the error alert.
- Body shows check-in code first, then package (only if a pack exists), then
  sessions. Empty-sessions state still renders.
- Onboarding tour still highlights the check-in code card and first session.
