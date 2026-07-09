# My Schedule Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the client My Schedule reminders + connect-trainer cards into a top-right ⋮ overflow menu, leaving check-in code → session package → sessions in the body.

**Architecture:** Single-file change to `frontend/app/my-schedule.tsx`. Reuse the existing `ProfileMenuModal` for the ⋮ dropdown (reminders as an inline `Switch` via the item `trailing` slot; connect-trainer as an item that opens a `Modal`). No backend/API changes.

**Tech Stack:** React Native (Expo), expo-router, RTK Query. Verification is `tsc --noEmit` + manual (RN screen UI, no unit harness for this screen).

## Global Constraints

- No new dependencies.
- No backend/API changes — reuse existing RTK Query hooks.
- Reuse existing i18n keys (`remindersTitle`, `remindersHint`, `inviteEnterTitle`, `inviteEnterHint`, `inviteCodePh`, `inviteConnectBtn`, `inviteConnecting`, `inviteYourTrainers`, etc.). No new strings.
- Preserve onboarding tour targets: `client-code-card` wraps the check-in code card; `client-schedule-list` wraps the first session card.
- New Architecture is disabled; single light theme; use `theme`/`typography` tokens.

---

### Task 1: Overflow menu + connect sheet + body reorder

**Files:**
- Modify: `frontend/app/my-schedule.tsx`
- Reuse (no change): `frontend/src/components/ProfileMenuModal.tsx`

**Interfaces:**
- Consumes: `ProfileMenuModal` (default export) + `ProfileMenuItem` type from `../src/components/ProfileMenuModal`. `ProfileMenuItem = { key; icon; label; onPress; destructive?; disabled?; loading?; trailing? }`.
- Consumes (existing, already in file): `remindersOn: boolean`, `onToggleReminders(value: boolean)`, `savingReminders: boolean`, `trainerCode`/`setTrainerCode`, `onRedeemCode()`, `isRedeeming`, `myTrainers`, `router`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add imports + local UI state**

Add to the react-native import: `Modal`. Add expo-router `Stack`. Add the menu component import.

```tsx
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import ProfileMenuModal, { type ProfileMenuItem } from "../src/components/ProfileMenuModal";
```

Inside the component, near the other `useState` calls:

```tsx
const [menuVisible, setMenuVisible] = useState(false);
const [connectVisible, setConnectVisible] = useState(false);
```

- [ ] **Step 2: Build the menu items (after handlers, before the role guard)**

```tsx
const menuItems: ProfileMenuItem[] = [
  {
    key: "reminders",
    icon: "notifications-outline",
    label: t("remindersTitle"),
    onPress: () => {},
    disabled: savingReminders,
    trailing: (
      <Switch
        value={remindersOn}
        onValueChange={onToggleReminders}
        disabled={savingReminders}
        trackColor={{ true: theme.colors.primary }}
      />
    ),
  },
  {
    key: "connect",
    icon: "person-add-outline",
    label: t("inviteEnterTitle"),
    onPress: () => {
      setMenuVisible(false);
      setConnectVisible(true);
    },
  },
];
```

- [ ] **Step 3: Wrap the main return in a Fragment with header button, menu, and connect sheet**

Replace the final `return ( <FlatList ... /> )` so the FlatList is one child of a Fragment that also renders `<Stack.Screen>` (headerRight ⋮), `ProfileMenuModal`, and the connect `Modal`:

```tsx
return (
  <>
    <Stack.Screen
      options={{
        headerRight: () => (
          <PressableScale
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t("openProfileMenu")}
            style={{ paddingHorizontal: 4, paddingVertical: 4 }}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
          </PressableScale>
        ),
      }}
    />
    <FlatList
      /* ...existing FlatList props unchanged... */
    />
    <ProfileMenuModal
      visible={menuVisible}
      onClose={() => setMenuVisible(false)}
      items={menuItems}
    />
    <Modal visible={connectVisible} transparent animationType="slide" onRequestClose={() => setConnectVisible(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setConnectVisible(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.cardHeader}>
            <View style={styles.sessionIconWrap}>
              <Ionicons name="person-add-outline" size={16} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>{t("inviteEnterTitle")}</Text>
            <PressableScale onPress={() => setConnectVisible(false)} style={{ marginLeft: "auto" }} accessibilityRole="button" accessibilityLabel={t("close")}>
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </PressableScale>
          </View>
          <Text style={styles.text}>{t("inviteEnterHint")}</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              value={trainerCode}
              onChangeText={setTrainerCode}
              placeholder={t("inviteCodePh")}
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <GradientButton
              title={isRedeeming ? t("inviteConnecting") : t("inviteConnectBtn")}
              onPress={onRedeemCode}
              loading={isRedeeming}
            />
          </View>
          {myTrainers.length > 0 && (
            <View style={styles.myTrainersWrap}>
              <Text style={styles.myTrainersLabel}>{t("inviteYourTrainers")}</Text>
              {myTrainers.map((trainer) => (
                <PressableScale
                  key={trainer.trainerId}
                  style={styles.myTrainerRow}
                  onPress={() => { setConnectVisible(false); router.push(`/trainers/${trainer.trainerId}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${trainer.firstName} ${trainer.lastName}`}
                >
                  <Ionicons name="barbell-outline" size={15} color={theme.colors.primary} />
                  <Text style={styles.myTrainerName}>{trainer.firstName} {trainer.lastName}</Text>
                  <Ionicons name="chevron-forward" size={15} color={theme.colors.textSecondary} />
                </PressableScale>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  </>
);
```

Add `Pressable` to the react-native import (Step 1) — it is used by the sheet overlay.

- [ ] **Step 4: Trim the FlatList `ListHeaderComponent` to code → package**

In `ListHeaderComponent`, keep the check-in code card (with its `codeCardTourRef` wrapper) as the first element and the `myPacks.length > 0` package card as the second. **Delete** the reminders `FadeInUp` card and the connect-trainer `FadeInUp` card (the `person-add-outline` block with the invite input + trainers list — now in the Modal). Result order: code card, then packs card.

- [ ] **Step 5: Add the two sheet styles**

Append to `StyleSheet.create({...})`:

```tsx
sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
sheet: {
  backgroundColor: theme.colors.surface,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: theme.spacing.lg,
  paddingBottom: theme.spacing.xxl,
  gap: 6,
  ...theme.shadows.medium,
},
```

Confirm `close` i18n key exists; if not, reuse an existing dismissal key (e.g. `cancel`) rather than adding a string.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/my-schedule.tsx
git commit -m "feat(schedule): move reminders + connect-trainer into My Schedule overflow menu"
```

## Manual verification (post-implementation)

On a client account:
- ⋮ shows in the header, opens the dropdown top-right.
- Reminders switch toggles (off→on prompts for permission, on→off disables) and persists.
- "Connect a trainer" opens the sheet; valid code connects + lists trainer; invalid shows error alert; tapping a trainer navigates to their profile.
- Body order: check-in code → package (only when a pack exists) → sessions. Empty-sessions state still renders.
- Tour still highlights the check-in code card and first session.

## Self-Review

- **Spec coverage:** header ⋮ (Steps 1–3), reminders inline switch (Step 2), connect sheet (Step 3), body reorder code→package (Step 4), no API change (constraints), tour targets preserved (Step 4 keeps `codeCardTourRef`; `scheduleListTourRef` untouched in `renderItem`). All spec sections covered.
- **Placeholder scan:** none — full code shown per step.
- **Type consistency:** `ProfileMenuItem` fields match the component; `menuItems`, `menuVisible`, `connectVisible` used consistently.
