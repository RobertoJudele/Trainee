# Fix: fmt `consteval` Build Error with Xcode 26

## Problem

When building with **Xcode 26** (iOS/iPhoneOS 26.5 SDK), the `fmt` library (used by React Native via Folly) fails with:

```
call to consteval function 'fmt::basic_format_string<...>::basic_format_string<FMT_COMPILE_STRING, 0>'
is not a constant expression
```

This happens in `ios/Pods/fmt/include/fmt/format-inl.h` at lines 59, 60, 1387, 1391, and 1394.

## Root Cause

The `fmt` library defines `FMT_CONSTEVAL` as `consteval` when the compiler reports C++20 support. Xcode 26's Clang reports C++20 support but has a bug where `consteval` doesn't work correctly in certain contexts (like `FMT_STRING` macros). The fix is to force `FMT_CONSTEVAL` to use `constexpr` instead.

## Fix

### Option 1: Expo Config Plugin (automated, survives `expo prebuild`)

The file `plugins/withFmtFix.js` is an Expo config plugin that automatically patches the fmt header files after `pod install`. It's registered in `app.json`:

```json
"plugins": [
  ...
  "./plugins/withFmtFix"
]
```

### Option 2: Manual Fix (after `pod install` or `npx expo prebuild`)

Edit the fmt header file directly:

```bash
# Find which file defines FMT_CONSTEVAL
grep -r "define FMT_CONSTEVAL" ios/Pods/fmt/include/fmt/

# Edit the file (usually core.h or format.h)
# Change:
#   #define FMT_CONSTEVAL consteval
# To:
#   #define FMT_CONSTEVAL constexpr
```

Or run this one-liner after every `pod install`:

```bash
sed -i '' 's/define FMT_CONSTEVAL consteval/define FMT_CONSTEVAL constexpr/g' \
  ios/Pods/fmt/include/fmt/core.h \
  ios/Pods/fmt/include/fmt/format.h 2>/dev/null
```

> **Note:** Manual fixes are wiped by `npx expo prebuild --clean`. Use the config plugin (Option 1) for a permanent fix.

## Verification

After applying the fix, build with:

```bash
eas build --platform ios --local
```

Or verify locally:

```bash
xcodebuild -workspace ios/Trainee.xcworkspace -scheme Trainee \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build
```
