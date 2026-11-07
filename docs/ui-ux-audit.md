# Salvio — UI/UX audit (frontend)

2026-11-07 · Method: the ui-ux-pro-max skill's priority rules, its React Native stack
guidelines and its pre-delivery checklist, applied as a static scan of all 55 `.tsx`
files under `frontend/app`, `src` and `features`. Each finding below was checked
by hand. **Not covered:** nothing was run on a device. VoiceOver/TalkBack,
largest-text and small-screen checks still need a phone (see the end).

## Summary

| # | Finding | Rule (skill priority) | Severity |
|---|---------|----------------------|----------|
| 1 | White text on the brand green fails contrast (2.5:1) on every primary button | Accessibility (1) | Critical |
| 2 | Green text on white/background fails contrast (2.5:1) in ~40 places | Accessibility (1) | Critical |
| 3 | The trainer contact buttons (WhatsApp, Instagram, phone…) have no screen-reader label | Accessibility (1) | High |
| 4 | Accessibility labels are hard-coded English, so Romanian users hear English | Accessibility (1) | High |
| 5 | The trainer profile edit form (11 fields) has no keyboard handling | Forms (8) | High |
| 6 | Some touch targets are under 44pt with no `hitSlop` | Touch (2) | Medium |
| 7 | Animations ignore the system "Reduce Motion" setting | Animation (7) | Medium |
| 8 | Off-brand colours (indigo, bootstrap blue) and 75 different raw hex values | Style / Color (4, 6) | Medium |
| 9 | Errors are shown with native `Alert` popups (116 calls), not next to the field | Forms (8) | Medium |
| 10 | Dead and placeholder screens, one reachable by deep link | Navigation (9) | Low |
| 11 | Text under 12px and grey-on-white hints | Typography (6) | Low |
| 12 | Long lists rendered as `ScrollView` + `.map()` | Performance (3) | Low |

What's already good: almost every icon-only button has `accessibilityRole` and a
label (21 of 25). Vector icons come from one family (Ionicons), with no emoji
in live screens. Animations use the native driver. Inputs keep taps working with
`keyboardShouldPersistTaps`. The debug panel in checkout only shows in `__DEV__`
builds. Trainer cards on Home show the rate.

---

## 1 · White on brand green: 2.54:1 (needs 4.5:1, or 3:1 for large bold text)

`GradientButton` (`src/components/ui/index.tsx:319`) draws white bold text on
`theme.gradients.primary` (`#10B981 → #059669`). At the light end the ratio is
**2.54:1**, which fails even the large-text minimum of 3:1. The same pair appears on the Welcome screen
gradient, on chips and badges with `backgroundColor: theme.colors.primary`, and on
the tab/active states.

Measured (WCAG relative luminance):

| Pair | Ratio |
|------|-------|
| white on `#10B981` (primary) | 2.54 ✗ |
| white on `#059669` (tertiary) | 3.77 (large text only) |
| white on `#047857` (emerald-700) | 5.48 ✓ |
| ink `#14181A` on `#10B981` | 7.04 ✓ |

**Fix (pick one, apply in `theme.ts`):**
- Keep the bright green and put **ink text on it** (`#14181A`, 7.0:1). This matches
  the app icon (black S on green) and the Salvio design system.
- Or keep white text and darken the button gradient to `#047857 → #065F46`.

## 2 · Green text on light surfaces: 2.4–2.5:1

About 40 styles use `color: theme.colors.primary` for text: links, "See all",
prices, active labels. That's 2.54:1 on white and 2.42:1 on the `#F8FAFC`
background.
**Fix:** add a `primaryText: '#047857'` token (5.2–5.5:1) and use it for all
green *text*. Keep `#10B981` for fills, dots and icons that sit next to a text label.

## 3 · Contact buttons have no label

`app/trainers/[id].tsx:722`: the row of contact icons (WhatsApp, Instagram,
phone, email) is the main conversion action on a trainer's page. Each is a
`TouchableOpacity` with only an icon inside, so VoiceOver and TalkBack read
"button" with no name.
**Fix:** `accessibilityRole="button"` and
`accessibilityLabel={t("contactVia", { channel: option.label })}`.

Other unlabeled icon-only buttons:
- `features/trainer/TrainerProfile.tsx:411`: back arrow
- `features/trainer/TrainerProfile.tsx:416`: ⋯ menu
- `features/trainer/TrainerProfile.tsx:525`: delete package row
- `features/users/CreateTrainer.tsx:384`: delete package row

## 4 · English-only accessibility labels

The app is bilingual, but 25+ `accessibilityLabel`s are string literals, so a Romanian
VoiceOver user hears English. Examples: "Go back" (`_layout.tsx`,
`legal.tsx`, `map.tsx`, `ScreenHeader.tsx`), "Close gym details" (`map.tsx`),
"Apply Filters" / "Clear search" (`search.tsx`), "Edit review" / "Delete review"
(`trainers/[id].tsx`), "Change profile picture" (`EditableAvatar.tsx`),
"Delete image" (`TrainerImageSection.tsx`), "Close sheet" (`SchedulePrimitives.tsx`)
and the onboarding tour's demo labels (`CoachMark.tsx`).
**Fix:** route every label through `t()`. Most keys exist already (`goBack`,
`close`, `delete`…).

## 5 · Edit form without keyboard handling

`features/trainer/TrainerProfile.tsx` has 11 `TextInput`s (bio, rates, packages…)
in a `ScrollView` with no `KeyboardAvoidingView` and no
`automaticallyAdjustKeyboardInsets`. On iOS the keyboard covers the lower fields
(package prices) while the trainer types.
Also missing it: `app/search.tsx` (5 inputs in the filter sheet), `app/my-gyms.tsx`,
`app/my-schedule.tsx` and `app/trainers/[id].tsx` (review text).
**Fix:** on the ScrollView, add `automaticallyAdjustKeyboardInsets` (iOS) plus
`keyboardShouldPersistTaps="handled"`. Or wrap the screen in
`KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}`.

## 6 · Small touch targets

| Where | Size | Fix |
|-------|------|-----|
| `src/components/TrainerImageSection.tsx:150` `deleteBtn` | 24×24, no hitSlop | `hitSlop={10}` |
| `app/map.tsx:1709` gym sheet `closeBtn` | 30×30 | `hitSlop={8}` |
| `app/legal.tsx`, `app/blocked-accounts.tsx` `backButton` | 40×40 | 44×44 or `hitSlop={4}` |
| Trash icons in package rows (`TrainerProfile.tsx:525`, `CreateTrainer.tsx:384`) | icon only, ~18–20px | wrap in 44×44 + `hitSlop` |

These are also destructive actions sitting next to text inputs, so a near miss is costly.

## 7 · Reduce Motion is ignored

`FadeInUp` and `PressableScale` (`src/components/ui/index.tsx`) animate every
screen entrance and press. Nothing checks `AccessibilityInfo.isReduceMotionEnabled()`.
**Fix:** read it once in a small hook. When it's on, make `FadeInUp` render at its
final opacity and position, and skip the press scale.

## 8 · Colour consistency

- **Off-brand colours on brand surfaces:** indigo `#6366F1` is used for the spinners and the
  retry button on the trainer profile (`TrainerProfile.tsx:377, 625, 785`) and in
  `TrainerSchedule.tsx:205`. Blue `#3B82F6` is the *selected* specialization chip
  (`TrainerProfile.tsx:788`) and the spinner in `CreateTrainer.tsx:327`.
  Elsewhere the same states are emerald.
- **Two different schedule greens and blues:** `#198754` / `#0D6EFD` (Bootstrap)
  in `SchedulePrimitives.tsx:26` and `MonthCalendar.tsx:8`, next to the theme's
  `#10B981`.
- **75 distinct raw hex values** across screens (`#FFF` and `#FFFFFF` are both used 50+ times;
  `#333`, `#666`, `#999` alongside the slate scale). The worst files are
  `TrainerProfile.tsx` (46), `map.tsx` (35) and `trainer-schedule/[date].tsx` (23).
- **Two brand greens:** `theme.ts` uses `#10B981`, while the Salvio design
  system and app icon use `#12B177`. They're close but not the same.

**Fix:** add semantic tokens (`textMuted`, `surfaceSunken`, `statusBooked`,
`statusFree`, `danger`…) to `theme.ts`, then replace the literals file by file,
starting with the worst offenders.

## 9 · Errors in Alert popups

116 `Alert.alert` calls, including 22 in the day planner and 20 in checkout. Form
validation errors ("rate must be a number", "budget minimum must be a number")
pop a native modal instead of showing next to the field, so the user has to
dismiss it and then work out which field was wrong.
**Fix:** keep `Alert` for confirmations of destructive actions. Show validation
as inline text under the field (`Field` in `ui/index.tsx` is the place to add an
`error` prop).

## 10 · Dead and placeholder screens

- `app/trainersIndex.tsx` is a live route that renders the plain text
  "Trainers Index". expo-router makes it reachable by deep link (`/trainersIndex`).
  Delete it.
- `features/trainer/TrainerSchedule.tsx` isn't imported anywhere. It has emoji as icons
  (👤 📅 🎉 ✅) and hard-coded Romanian ("Clienți Neasignați", "Sloturi Orare").
  Delete it.
- `src/components/TrainerCard.tsx` is a stub that returns an empty `<View>`, and
  `features/users/UserList.tsx` is unused. Delete both.

## 11 · Small and faint text

13 font sizes are under 12px. Most are tracked-out labels, which is acceptable. One isn't:
`app/map.tsx:1722`, the "pull up for full screen" hint, is **11px in `#9CA3AF`
(2.54:1)**. `TrainerProfile.tsx:795` `infoLabel` is `#999` (2.85:1).
**Fix:** use `theme.colors.textSecondary` (`#64748B`, 4.8:1 on white) as the
lightest text colour anywhere.

## 12 · Lists

14 screens render lists with `ScrollView` + `.map()`. That's fine for short fixed
lists (legal, analytics, menus). Watch two of them:
- `app/map.tsx:1095`: gym search results
- `app/trainers/[id].tsx`: reviews

Both grow with data. Switch them to `FlatList` once a city has more than about 50 gyms or a
trainer has more than about 30 reviews.

---

## Still to check on a device

From the skill's pre-delivery checklist. These can't be checked from code:

- [ ] VoiceOver (iOS) and TalkBack (Android) through signup → search → trainer → contact
- [ ] Largest system text size (Dynamic Type / Android font scale). The app sets no
      `maxFontSizeMultiplier`, so fixed-height chips, tab labels and the map sheet
      header may clip
- [ ] Small phone (iPhone SE, 375pt) and the map sheet in landscape
- [ ] Reduce Motion on, after fix 7
- [ ] Safe areas on the map's floating buttons and bottom sheet with the gesture bar

## Suggested order

1. Contrast tokens (findings 1, 2 and 11): one theme change fixes most of the app.
2. Labels (3, 4): a mechanical change of about an hour.
3. Keyboard handling on the trainer edit form (5).
4. Touch targets (6) and Reduce Motion (7).
5. Delete the dead screens (10).
6. Colour tokens (8) and inline errors (9), one screen at a time.
