# Build & Version Configuration Checklist

**Date:** June 6, 2026  
**App Version:** 1.0.0  
**Status:** READY ✅ (Minor cleanups needed)

---

## Version & Build Numbers

### Current Configuration ✅
```json
{
  "version": "1.0.0",
  "ios": {
    "bundleIdentifier": "com.juroctech.frontend"
  },
  "android": {
    "package": "com.juroctech.frontend"
  }
}
```

### Status
- ✅ Version: 1.0.0 (correct format)
- ✅ iOS Bundle ID: com.juroctech.frontend (set)
- ✅ Android Package: com.juroctech.frontend (matches)

### iOS Build Number
- ⚠️ **Not explicitly set in app.json**
- Default: Expo will use commit count or auto-increment
- Recommendation: Explicitly set before submission

**To Set Build Number:**
```json
{
  "ios": {
    "buildNumber": "1"
  }
}
```

---

## App Configuration

### Display Name & Icons ✅
- ✅ App name: "Trainee" (clear and concise)
- ✅ App icon: ./assets/icon.png
- ✅ Splash screen: ./assets/splash-icon.png
- ✅ Adaptive icon (Android): ./assets/adaptive-icon.png
- ✅ Favicon (Web): ./assets/favicon.png

### Icon Specifications
**Status: VERIFY**
- ⚠️ Asset files exist but size not verified
- Need to check: 1024x1024 px, no transparency

**To Verify:**
```bash
identify frontend/assets/icon.png
```

### iOS Configuration
```json
{
  "supportsTablet": true,
  "bundleIdentifier": "com.juroctech.frontend",
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false
  }
}
```

- ✅ Tablet support enabled
- ✅ Encryption: Not claimed (correct for content-only apps)
- ⚠️ Minimum iOS version not explicitly set (defaults to 13.0+)

**Recommendation:** Set minimum iOS explicitly:
```json
{
  "ios": {
    "deploymentTarget": "13.4"
  }
}
```

### Android Configuration ✅
```json
{
  "package": "com.juroctech.frontend",
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.INTERNET"
  ],
  "edgeToEdgeEnabled": true
}
```

- ✅ Correct package name
- ✅ Permissions defined
- ✅ Modern configuration

---

## Debug Code & Console Logs

### Findings
- **Total console.* statements:** 34 in features directory
- **Locations:** auth, billing, checkout, schedule, etc.
- **Examples:**
  ```typescript
  console.log("Login mutation called wih:", credentials);
  console.log("🔴 Signup error response:", JSON.stringify(response));
  console.error("Failed to fetch RevenueCat offerings:", error);
  ```

### Production Issues
- ❌ **Console logs leak data** (credentials, error details)
- ⚠️ **Performance:** Extra processing in production
- ⚠️ **Security:** May expose sensitive information to debuggers

### Removal Strategy

**Option 1: Simple Removal** (Recommended)
- Search/replace `console.log` → comment out or remove
- Search/replace `console.error` → keep if truly needed
- Effort: 30 minutes

**Option 2: Conditional Logging** (Best Practice)
```typescript
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  console.log("Debug info");
}
```

**Option 3: Use Logger**
```typescript
// Create logging utility
import { logger } from '../utils/logger';
logger.debug("message"); // Only in dev
logger.error("error"); // In all envs, sent to error tracking
```

### Files with Console Statements
1. `features/auth/authApiSlice.ts` - 6+ statements
2. `features/billing/billingApiSlice.ts` - 4+ statements
3. `app/checkout.tsx` - 5+ statements
4. `app/app.tsx` (layout) - unknown
5. Various controller/screen files - remaining

### Action Items
- [ ] Search entire codebase for console.* statements
- [ ] Remove/comment out debug logs
- [ ] Keep only error logging if using error tracking
- [ ] Verify no credentials/sensitive data in any logs

---

## Build Optimization

### Release Build Configuration
- ✅ Expo handles optimization automatically
- ✅ Minification enabled by default with EAS
- ✅ Tree-shaking enabled for unused code removal

### Manual Optimization Checks
- ⚠️ devTools setting should be false for production
  ```typescript
  // In store.ts - currently has devTools: true
  configureStore({
    reducer: {...},
    middleware: ...,
    devTools: true, // ❌ Should be false for production
  })
  ```

**Fix Needed:**
```typescript
configureStore({
  devTools: __DEV__, // Only in development
})
```

### Build Command for EAS
```bash
eas build --platform ios --release
```

---

## Assets Verification Checklist

### Icons & Branding
- [ ] icon.png: 1024x1024 px, no transparency ⏳ Need to verify
- [ ] adaptive-icon.png: Has foreground + background ✅
- [ ] splash-icon.png: High quality, visible on all sizes ✅
- [ ] favicon.png: Web only, less critical ✅

### App Store Screenshots (MISSING)
- ❌ **No App Store screenshots provided yet**
- Required: 2-5 per language minimum
- Recommended: 10 per language for best visibility
- Size: 1290x1920px for iPhone (6.7" display)

**To Create:**
1. Run app on iPhone simulator
2. Screenshot key features:
   - Login/Sign up
   - Trainer search/browse
   - Trainer profile
   - Booking flow
   - Payment/subscription
   - User profile

---

## Pre-Release Build Checklist

### Before EAS Build
- [ ] Version bumped to 1.0.0 ✅
- [ ] iOS build number set (add to config)
- [ ] Bundle ID correct: com.juroctech.frontend ✅
- [ ] All console logs removed/controlled
- [ ] devTools set to false for release
- [ ] Icons verified as 1024x1024px
- [ ] App names set correctly
- [ ] Minimum iOS version set
- [ ] Screenshots prepared (10x per language)

### EAS Configuration (eas.json)
- ⚠️ **Not reviewed** - verify exists and is correct

**Check for:**
```json
{
  "build": {
    "release": {
      "ios": {...}
    }
  }
}
```

### Build Steps
```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Link project
eas build:configure

# 3. Build for iOS
eas build --platform ios --release

# 4. Build for Android (separate build)
eas build --platform android --release
```

---

## Configuration Issues Found

### CRITICAL (Must Fix Before Build)
1. ❌ **Console logs throughout codebase** (34+ statements)
   - Action: Remove all debug logs
   - Effort: 30 minutes

### HIGH (Should Fix Before Submission)
2. ⚠️ **devTools: true in Redux store**
   - Action: Change to `__DEV__` or false
   - Effort: 2 minutes

3. ⚠️ **iOS build number not set**
   - Action: Add `"buildNumber": "1"` to app.json
   - Effort: 1 minute

4. ❌ **App Store screenshots not created**
   - Action: Create 10+ screenshots per language
   - Effort: 1-2 hours

### MEDIUM (Nice-to-Have)
5. ⚠️ **Minimum iOS version not explicit**
   - Action: Add `"deploymentTarget": "13.4"`
   - Effort: 1 minute

6. ⚠️ **Icon size not verified**
   - Action: Check icon.png is 1024x1024px
   - Effort: 5 minutes

---

## Summary Table

| Item | Status | Action |
|------|--------|--------|
| Version (1.0.0) | ✅ | None |
| Bundle ID | ✅ | None |
| iOS Build Number | ⚠️ | Add to config |
| Display Name | ✅ | None |
| Icons | ✅ Exist | Verify size |
| Console Logs | ❌ 34+ found | Remove all |
| devTools | ❌ true | Set to false |
| Screenshots | ❌ Missing | Create 10+ |
| Minimum iOS | ⚠️ Default | Set explicit |
| App Store | ⚠️ | Prepare all assets |

---

## Estimated Timeline

| Task | Effort | Priority |
|------|--------|----------|
| Remove console logs | 30 min | CRITICAL |
| Fix devTools setting | 2 min | CRITICAL |
| Verify icon size | 5 min | HIGH |
| Add iOS build number | 1 min | HIGH |
| Add iOS deployment target | 1 min | MEDIUM |
| Create App Store screenshots | 1-2 hours | HIGH |
| **Total** | **2.5 hours** | — |

---

## Sign-Off

**Status:** MOSTLY READY ✅ (Minor cleanups required)

Core build configuration is solid. Primary actions needed are:
1. Remove debug console logs (30 min)
2. Create App Store screenshots (1-2 hours)
3. Fix devTools and build number (3 min)

All items can be completed before submission. No blockers for EAS build.

**Next Step:** Run `eas build --platform ios --release` after cleanups complete.
