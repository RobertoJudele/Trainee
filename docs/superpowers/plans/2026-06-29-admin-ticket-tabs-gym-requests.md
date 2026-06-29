# Admin Ticket Tabs + User Gym Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users request a new gym (reviewed as a ticket) and give admins a tabbed, filterable ticket screen.

**Architecture:** Gym requests reuse the existing `Issue` model as a new `targetType: "gym"` / `category: "gym_request"`, with gym fields in the existing `metadata` JSONB column. No new table, no new endpoint, no auto-create — an admin reads the request and creates the gym manually. The admin screen filters the already-fetched issue list client-side into tabs (by target type) with an Open/Closed sub-filter.

**Tech Stack:** Express + Sequelize-TypeScript + Postgres (backend, Jest+supertest tests), React Native / Expo Router + RTK Query (frontend).

## Global Constraints

- Postgres ENUM values cannot be added by `sequelize.sync({ alter: false })` (the prod/dev path in `server/src/index.ts:97`). New values need `ALTER TYPE ... ADD VALUE IF NOT EXISTS` in `ensureSpatialAndSearchInfrastructure`. (Test DB uses `sync({ force: true })`, so tests get the new values from the model automatically.)
- `Issue.title` validator: length 5–140. `Issue.description` validator: length 10–2000. Request submissions must satisfy both (compose a description from the address if needed).
- Sequelize enum type names: target_type → `enum_issues_target_type`; category → `enum_issues_category`.
- Frontend has no screen-level test harness (tests are backend-only). Frontend tasks gate on `cd frontend && npx tsc --noEmit` plus a stated manual check, matching repo convention.
- i18n: every user-facing string goes through `t("key")`; add both EN and RO keys in `frontend/src/lib/i18n/translations.ts`.

---

### Task 1: Backend — add gym enum values + live-DB migration

**Files:**
- Modify: `server/src/types/issue.ts:1-13`
- Modify: `server/src/services/databaseBootstrap.ts` (append to `ensureSpatialAndSearchInfrastructure`, before its closing `};` at line ~171)

**Interfaces:**
- Produces: `IssueTargetType.GYM = "gym"`, `IssueCategory.GYM_REQUEST = "gym_request"` (consumed by Tasks 2, 3).

- [ ] **Step 1: Add the enum values**

In `server/src/types/issue.ts`, extend the two enums:

```typescript
export enum IssueCategory {
  TRAINER_BEHAVIOR = "trainer_behavior",
  BOOKING_NO_SHOW = "booking_no_show",
  TECHNICAL_BUG = "technical_bug",
  PAYMENT_ISSUE = "payment_issue",
  GYM_REQUEST = "gym_request",
  OTHER = "other",
}

export enum IssueTargetType {
  TRAINER = "trainer",
  BOOKING = "booking",
  APP = "app",
  GYM = "gym",
}
```

- [ ] **Step 2: Add the live-DB ENUM migration**

In `server/src/services/databaseBootstrap.ts`, add at the end of `ensureSpatialAndSearchInfrastructure` (just before the final `};`):

```typescript
  // Gym-request ticket type: add new enum values to existing issue enums.
  // sync({ alter:false }) won't add enum values, so do it explicitly. Idempotent.
  await sequelize.query(
    "ALTER TYPE enum_issues_target_type ADD VALUE IF NOT EXISTS 'gym';"
  ).catch((err) => console.warn("Could not add 'gym' target_type enum value:", err.message));
  await sequelize.query(
    "ALTER TYPE enum_issues_category ADD VALUE IF NOT EXISTS 'gym_request';"
  ).catch((err) => console.warn("Could not add 'gym_request' category enum value:", err.message));
```

- [ ] **Step 3: Verify the server boots and the enums exist**

Run: `cd server && npm run dev`
Expected: logs `✅ Database synchronized and optimized.` with no enum errors. Stop the server (Ctrl-C) once you see it.

- [ ] **Step 4: Commit**

```bash
git add server/src/types/issue.ts server/src/services/databaseBootstrap.ts
git commit -m "feat(server): add gym-request ticket enum values + live-DB migration"
```

---

### Task 2: Backend — validate gym requests in createIssue

**Files:**
- Modify: `server/src/controllers/issue.ts:36-118` (the `createIssue` body)
- Test: `server/src/tests/issue.test.ts` (add cases in the existing `describe("POST /issues")`)

**Interfaces:**
- Consumes: `IssueTargetType.GYM`, `IssueCategory.GYM_REQUEST` from Task 1.
- Produces: `POST /issues` accepts gym requests with `metadata: { address, city?, latitude, longitude }`; rejects gym requests missing coords or carrying trainer/booking IDs.

- [ ] **Step 1: Write the failing tests**

Add inside `describe("POST /issues", ...)` in `server/src/tests/issue.test.ts`:

```typescript
    it("should create a gym request", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "gym",
          category: "gym_request",
          title: "World Class Pipera",
          description: "Str. Dimitrie Pompeiu 5, Bucharest — please add this gym",
          metadata: {
            address: "Str. Dimitrie Pompeiu 5, Bucharest",
            city: "Bucharest",
            latitude: 44.4796,
            longitude: 26.1213,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetType).toBe("gym");
      expect(res.body.data.metadata.latitude).toBe(44.4796);
    });

    it("should reject a gym request without coordinates", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/issues")
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetType: "gym",
          category: "gym_request",
          title: "Nameless Gym Request",
          description: "I forgot to drop a pin on the map for this one",
          metadata: { address: "Somewhere" },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx jest issue.test.ts -t "gym request"`
Expected: both new cases FAIL (the create currently succeeds without coords → second test fails; first may pass or fail depending on metadata round-trip).

- [ ] **Step 3: Add the gym validation branch**

In `server/src/controllers/issue.ts`, inside `createIssue`, after the existing
`if (targetType === IssueTargetType.APP ...)` block (around line 81) and before the
duplicate-window check, add:

```typescript
    if (targetType === IssueTargetType.GYM) {
      if (trainerId || bookingId) {
        sendError(res, 400, "Gym requests should not include trainerId or bookingId");
        return;
      }
      const lat = Number((metadata as Record<string, unknown> | undefined)?.latitude);
      const lng = Number((metadata as Record<string, unknown> | undefined)?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        sendError(res, 400, "Gym requests require metadata.latitude and metadata.longitude");
        return;
      }
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx jest issue.test.ts -t "gym request"`
Expected: both new cases PASS.

- [ ] **Step 5: Run the full issue suite for regressions**

Run: `cd server && npx jest issue.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/controllers/issue.ts server/src/tests/issue.test.ts
git commit -m "feat(server): validate gym-request tickets in createIssue"
```

---

### Task 3: Frontend — extend issue API types

**Files:**
- Modify: `frontend/features/support/issueApiSlice.ts:3-19,21-33`

**Interfaces:**
- Produces: `IssueTargetType` includes `"gym"`; `IssueCategory` includes `"gym_request"`; `CreateIssueRequest` and `IssueRecord` carry `metadata?: Record<string, unknown>` (consumed by Tasks 4, 5, 6).

- [ ] **Step 1: Extend the unions and interfaces**

In `frontend/features/support/issueApiSlice.ts`:

```typescript
export type IssueTargetType = "trainer" | "booking" | "app" | "gym";
export type IssueCategory =
  | "trainer_behavior"
  | "booking_no_show"
  | "technical_bug"
  | "payment_issue"
  | "gym_request"
  | "other";
```

Add `metadata?: Record<string, unknown>;` to both `CreateIssueRequest` (after `bookingId?`) and `IssueRecord` (after `bookingId?`).

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/features/support/issueApiSlice.ts
git commit -m "feat(frontend): add gym-request types to issue API slice"
```

---

### Task 4: Frontend — the "Request a gym" screen

**Files:**
- Create: `frontend/app/request-gym.tsx`
- Modify: `frontend/app/_layout.tsx:133` (register the route after the `report-issue` screen)

**Interfaces:**
- Consumes: `useCreateIssueMutation` and the extended types from Task 3.
- Produces: route `/request-gym` accepting optional params `lat`, `lng` (strings) for the initial pin; consumed by Task 6 entry points.

- [ ] **Step 1: Create the screen**

Create `frontend/app/request-gym.tsx`:

```tsx
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCreateIssueMutation } from "../features/support/issueApiSlice";
import { theme, typography } from "../src/lib/theme";
import { useLanguage } from "../src/lib/i18n/LanguageContext";
import { getApiErrorMessage } from "../src/lib/errors";

// Bucharest fallback when no pin params are passed.
const FALLBACK = { latitude: 44.4268, longitude: 26.1025 };

export default function RequestGymScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const initialLat = Number(params.lat);
  const initialLng = Number(params.lng);
  const start = {
    latitude: Number.isFinite(initialLat) ? initialLat : FALLBACK.latitude,
    longitude: Number.isFinite(initialLng) ? initialLng : FALLBACK.longitude,
  };

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState(start);
  const [createIssue, { isLoading }] = useCreateIssueMutation();

  const region: Region = {
    ...coords,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const onSubmit = async () => {
    if (name.trim().length < 5) {
      Alert.alert(t("validation"), t("gymNameMinLength"));
      return;
    }
    if (address.trim().length < 5) {
      Alert.alert(t("validation"), t("gymAddressRequired"));
      return;
    }

    try {
      await createIssue({
        targetType: "gym",
        category: "gym_request",
        title: name.trim(),
        description: `${address.trim()} (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`,
        metadata: {
          address: address.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      }).unwrap();
      Alert.alert(t("submitted"), t("gymRequestSubmitted"), [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert(t("error"), getApiErrorMessage(error, t("error")));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t("requestGymTitle")}</Text>
        <Text style={styles.subtitle}>{t("requestGymSubtitle")}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("gymName")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("gymNamePlaceholder")}
            maxLength={100}
          />

          <Text style={[styles.label, { marginTop: 6 }]}>{t("gymAddress")}</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder={t("gymAddressPlaceholder")}
            maxLength={200}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t("gymLocationHint")}</Text>
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              region={region}
              onPress={(e) => setCoords(e.nativeEvent.coordinate)}
            >
              <Marker
                coordinate={coords}
                draggable
                onDragEnd={(e) => setCoords(e.nativeEvent.coordinate)}
              />
            </MapView>
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={isLoading}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t("submitGymRequest")}
        >
          <Text style={styles.submitText}>
            {isLoading ? t("submitting") : t("submitGymRequest")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { ...typography.h2, color: theme.colors.text },
  subtitle: { ...typography.body2, color: theme.colors.textSecondary },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
    ...theme.shadows.small,
  },
  label: { ...typography.body2, color: theme.colors.text, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
  mapWrap: {
    height: 240,
    borderRadius: theme.roundness,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  map: { flex: 1 },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 14,
    alignItems: "center",
    ...theme.shadows.medium,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { ...typography.body1, color: "#fff", fontWeight: "700" },
});
```

- [ ] **Step 2: Register the route**

In `frontend/app/_layout.tsx`, add after line 133 (the `report-issue` screen):

```tsx
          <Stack.Screen name="request-gym" options={{ title: "Request a Gym" }} />
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual check**

Start the app (`cd frontend && npm start`), navigate to `/request-gym` (temporarily via a deep link or by wiring one entry point early). Confirm: the map renders, tapping/dragging moves the pin, and submitting with a valid name+address shows the success alert. (Full entry-point wiring is Task 6.)

- [ ] **Step 5: Commit**

```bash
git add frontend/app/request-gym.tsx frontend/app/_layout.tsx
git commit -m "feat(frontend): add Request-a-gym screen with map pin"
```

---

### Task 5: Frontend — admin tabs + Open/Closed filter + gym metadata cards

**Files:**
- Modify: `frontend/app/admin-issues.tsx` (whole component body + styles)

**Interfaces:**
- Consumes: `IssueRecord` (with `metadata`) and `IssueTargetType` from Task 3.
- Produces: nothing downstream.

- [ ] **Step 1: Add tab + filter state and derived filtering**

In `frontend/app/admin-issues.tsx`, after the existing `statuses` array (line 27), add tab definitions:

```tsx
const TARGET_TABS: Array<{ value: IssueTargetType; labelKey: string }> = [
  { value: "trainer", labelKey: "tabTrainer" },
  { value: "booking", labelKey: "tabBooking" },
  { value: "app", labelKey: "tabApp" },
  { value: "gym", labelKey: "tabGymRequests" },
];

const OPEN_STATUSES = ["open", "in_review"];
```

Import the type at the top: add `IssueTargetType` to the existing import from
`../features/support/issueApiSlice`.

Inside `AdminIssuesScreen`, after the existing hooks (near line 41), add:

```tsx
  const [activeTab, setActiveTab] = React.useState<IssueTargetType>("trainer");
  const [showOpen, setShowOpen] = React.useState(true);
```

Replace `const issues = data?.data || [];` (line 89) with:

```tsx
  const allIssues = data?.data || [];
  const issues = allIssues.filter((i) => {
    if (i.targetType !== activeTab) return false;
    const isOpen = OPEN_STATUSES.includes(i.status);
    return showOpen ? isOpen : !isOpen;
  });
```

- [ ] **Step 2: Render the tab bar + filter as the list header**

Add a `ListHeaderComponent` to the `FlatList` (the one returned at line 92):

```tsx
      ListHeaderComponent={
        <View>
          <View style={styles.tabBar}>
            {TARGET_TABS.map((tab) => (
              <Pressable
                key={tab.value}
                style={[styles.tab, activeTab === tab.value && styles.tabActive]}
                onPress={() => setActiveTab(tab.value)}
                accessibilityRole="button"
                accessibilityLabel={t(tab.labelKey)}
              >
                <Text
                  style={[styles.tabText, activeTab === tab.value && styles.tabTextActive]}
                >
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filterRow}>
            {[
              { open: true, labelKey: "filterOpen" },
              { open: false, labelKey: "filterClosed" },
            ].map((f) => (
              <Pressable
                key={f.labelKey}
                style={[styles.filterChip, showOpen === f.open && styles.filterChipActive]}
                onPress={() => setShowOpen(f.open)}
                accessibilityRole="button"
                accessibilityLabel={t(f.labelKey)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    showOpen === f.open && styles.filterChipTextActive,
                  ]}
                >
                  {t(f.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
```

- [ ] **Step 3: Render gym metadata on gym cards**

In the `renderItem` card (after the `description` Text, line 107), add:

```tsx
          {item.targetType === "gym" && item.metadata ? (
            <View style={styles.gymMeta}>
              <Text style={styles.meta}>
                {t("gymAddress")}: {String(item.metadata.address ?? "—")}
              </Text>
              <Text style={styles.meta}>
                {t("gymLocationLabel")}: {String(item.metadata.latitude ?? "?")},{" "}
                {String(item.metadata.longitude ?? "?")}
              </Text>
            </View>
          ) : null}
```

- [ ] **Step 4: Add the new styles**

Add to the `StyleSheet.create` block:

```tsx
  tabBar: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { ...typography.caption, color: theme.colors.text },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  filterChipText: { ...typography.caption, color: theme.colors.text },
  filterChipTextActive: { color: "#fff", fontWeight: "700" },
  gymMeta: { gap: 2, marginTop: 2 },
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual check**

As an admin, open Admin Issues. Confirm: four tabs render, switching tabs filters
the list by type, Open/Closed toggle works, and a gym-request ticket shows its
address and coordinates.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/admin-issues.tsx
git commit -m "feat(frontend): admin ticket tabs, open/closed filter, gym metadata"
```

---

### Task 6: Frontend — entry points to Request-a-gym

**Files:**
- Modify: `frontend/app/map.tsx` (add a button; uses existing `mapRegion` state at line 409)
- Modify: `frontend/app/report-issue.tsx` (add a CTA near the top of the form)
- Modify: `frontend/app/my-gyms.tsx` (add a "Request a gym" action)

**Interfaces:**
- Consumes: route `/request-gym` with `lat`/`lng` params from Task 4.

- [ ] **Step 1: Add the map entry point**

In `frontend/app/map.tsx`, ensure `useRouter` is imported from `expo-router`
(add it to the existing expo-router import if absent) and `const router = useRouter();`
exists in the component. Add a floating button inside the screen's root container
(after the `<MapView>`), passing the current center:

```tsx
        <Pressable
          style={mapStyles.requestGymBtn}
          onPress={() =>
            router.push({
              pathname: "/request-gym",
              params: {
                lat: String(mapRegion.latitude),
                lng: String(mapRegion.longitude),
              },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={t("requestGymCta")}
        >
          <Text style={mapStyles.requestGymBtnText}>{t("requestGymCta")}</Text>
        </Pressable>
```

Add to map.tsx's StyleSheet (named `mapStyles` — confirm the actual local name and
reuse it):

```tsx
  requestGymBtn: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...theme.shadows.medium,
  },
  requestGymBtnText: { color: "#fff", fontWeight: "700" },
```

If `map.tsx` does not already use `useLanguage`, import it and add
`const { t } = useLanguage();`.

- [ ] **Step 2: Add the report-issue entry point**

In `frontend/app/report-issue.tsx`, after the subtitle (line 122), add a CTA that
routes to the gym screen:

```tsx
      <Pressable
        style={styles.gymRequestCta}
        onPress={() => router.push("/request-gym")}
        accessibilityRole="button"
        accessibilityLabel={t("requestGymCta")}
      >
        <Text style={styles.gymRequestCtaText}>{t("requestGymCta")}</Text>
      </Pressable>
```

Add to its StyleSheet:

```tsx
  gymRequestCta: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 12,
    alignItems: "center",
  },
  gymRequestCtaText: { ...typography.body2, color: theme.colors.primary, fontWeight: "700" },
```

- [ ] **Step 3: Add the my-gyms entry point**

In `frontend/app/my-gyms.tsx`, add (importing `useRouter`/`useLanguage` if not
already present) a button near the screen's header/top action area:

```tsx
      <Pressable
        style={styles.requestGymLink}
        onPress={() => router.push("/request-gym")}
        accessibilityRole="button"
        accessibilityLabel={t("requestGymCta")}
      >
        <Text style={styles.requestGymLinkText}>{t("requestGymCta")}</Text>
      </Pressable>
```

Add matching styles to its StyleSheet:

```tsx
  requestGymLink: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  requestGymLinkText: { ...typography.body2, color: theme.colors.primary, fontWeight: "700" },
```

(Match the existing layout — place it where the screen lists/empties gyms. Confirm
the StyleSheet variable name and the root container while editing.)

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

Confirm each of the three screens shows a "Request a gym" control and tapping it
opens the screen (the map button pre-centers the pin on the current map view).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/map.tsx frontend/app/report-issue.tsx frontend/app/my-gyms.tsx
git commit -m "feat(frontend): add Request-a-gym entry points (map, report-issue, my-gyms)"
```

---

### Task 7: i18n — add EN + RO strings

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts` (the `en` object and the `ro` object)

**Interfaces:**
- Consumes: nothing. Produces the keys referenced in Tasks 4–6.

- [ ] **Step 1: Add the English keys**

In the `en` object, add (place under a new `// ─── Gym requests ───` comment block):

```typescript
  requestGymTitle: "Request a Gym",
  requestGymSubtitle: "Can't find your gym? Tell us about it and we'll add it.",
  requestGymCta: "Can't find your gym? Request it",
  gymName: "Gym name",
  gymNamePlaceholder: "e.g. World Class Pipera",
  gymNameMinLength: "Gym name must be at least 5 characters.",
  gymAddress: "Address",
  gymAddressPlaceholder: "Street, number, city",
  gymAddressRequired: "Please enter the gym address.",
  gymLocationHint: "Drop a pin on the gym's location",
  gymLocationLabel: "Location",
  submitGymRequest: "Submit request",
  gymRequestSubmitted: "Thanks! We'll review your gym request shortly.",
  tabTrainer: "Trainer",
  tabBooking: "Booking",
  tabApp: "App",
  tabGymRequests: "Gym Requests",
  filterOpen: "Open",
  filterClosed: "Closed",
```

- [ ] **Step 2: Add the Romanian keys**

In the `ro` object, add the same keys translated:

```typescript
  requestGymTitle: "Solicită o sală",
  requestGymSubtitle: "Nu găsești sala ta? Spune-ne și o adăugăm.",
  requestGymCta: "Nu găsești sala? Solicit-o",
  gymName: "Numele sălii",
  gymNamePlaceholder: "ex. World Class Pipera",
  gymNameMinLength: "Numele sălii trebuie să aibă cel puțin 5 caractere.",
  gymAddress: "Adresă",
  gymAddressPlaceholder: "Stradă, număr, oraș",
  gymAddressRequired: "Introdu adresa sălii.",
  gymLocationHint: "Plasează un punct pe locația sălii",
  gymLocationLabel: "Locație",
  submitGymRequest: "Trimite solicitarea",
  gymRequestSubmitted: "Mulțumim! Vom analiza solicitarea în curând.",
  tabTrainer: "Antrenor",
  tabBooking: "Programare",
  tabApp: "Aplicație",
  tabGymRequests: "Solicitări săli",
  filterOpen: "Deschise",
  filterClosed: "Închise",
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/i18n/translations.ts
git commit -m "feat(i18n): add gym-request and admin-tab strings (EN+RO)"
```

---

## Final verification

- [ ] Backend tests: `cd server && npx jest issue.test.ts` → all pass.
- [ ] Frontend typecheck: `cd frontend && npx tsc --noEmit` → clean.
- [ ] Manual end-to-end: submit a gym request as a user → it appears in the admin
  "Gym Requests" tab under Open, with address + coordinates → admin marks it
  resolved → it moves to Closed.
