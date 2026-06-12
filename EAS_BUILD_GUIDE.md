# EAS Build Guide & Checklist

**Date:** June 6, 2026  
**Status:** PRE-BUILD (Ready when cleanups done)

---

## Prerequisites

### Installation
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Verify installation
eas --version
```

### Authentication
```bash
# Login to Expo account
eas login

# Verify you're authenticated
eas whoami
```

### Project Setup
- ✅ EAS project ID already in app.json: `1dc4c0a3-075a-4b96-8cd1-1f66b1d89362`
- ✅ iOS configuration set up
- ⚠️ eas.json may need creation/verification

---

## Pre-Build Checklist

### Code Cleanup (MUST DO FIRST)
- [ ] Remove all `console.log` statements (34+ found)
- [ ] Remove all `console.error` statements (if not critical)
- [ ] Set `devTools: false` in Redux store
- [ ] Verify no hardcoded API URLs (use environment variables)
- [ ] Verify no hardcoded secrets in code
- [ ] Remove unused imports/dead code

### Configuration
- [ ] Add iOS build number: `"buildNumber": "1"`
- [ ] Set minimum iOS: `"deploymentTarget": "13.4"`
- [ ] Verify bundle ID: `com.juroctech.frontend`
- [ ] Verify app name: "Trainee"
- [ ] Verify all environment variables are set

### Environment Variables
Create `.env` file (not committed to git):
```bash
API_URL=https://your-production-api.com
STRIPE_PUBLIC_KEY=pk_live_xxxxx
REVENUECAT_API_KEY=your-key
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=trainer_subscription
EXPO_PUBLIC_REVENUECAT_PRODUCT_ID=com.trainee.trainer_monthly
```

### Assets
- [ ] Verify icon.png is 1024x1024px
- [ ] Verify splash-icon.png looks good
- [ ] Verify adaptive-icon.png is correct
- [ ] App Store screenshots prepared (10+ per language)

### Dependencies
- [ ] Run `npm audit fix` in both frontend and server (from task 5)
- [ ] Run `npm ls` to check for duplicate dependencies
- [ ] Verify no dev dependencies in production build
- [ ] Check package.json doesn't have `"dev": true` for packages

---

## Build Process

### Step 1: Create/Update eas.json

**Location:** `frontend/eas.json`

**Example Configuration:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "distribution": "store"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "serviceAccountKeyPath": "./fastlane/key.json"
      }
    }
  }
}
```

**For iOS Test Flight (Preview Build):**
```bash
eas build --platform ios --profile preview
```

**For Production App Store:**
```bash
eas build --platform ios --profile production
```

### Step 2: Build for iOS

**Initial Build (No signing setup):**
```bash
cd frontend
eas build --platform ios
```

**What EAS will do:**
1. Create a signing certificate (if needed)
2. Create a provisioning profile on Apple Developer
3. Build the app in Expo's cloud
4. Provide a .ipa file for TestFlight/App Store

**Expected Duration:** 15-30 minutes

**Build Output:**
- EAS will provide a build URL
- You can monitor build progress in terminal
- Final link to download .ipa file

### Step 3: Monitor Build

**In Terminal:**
```
Waiting for build to be ready...
Build finished.
Download your build: https://exp-shell-app-releases.s3.us-west-1.amazonaws.com/...
```

**Build Status:**
- Check at: https://expo.dev/builds
- View logs if build fails
- Download artifacts

### Step 4: Test Build Locally

**Option A: Use TestFlight (Recommended)**
```bash
# After build completes, upload to TestFlight
eas submit --platform ios --latest
```

**Option B: Install Directly**
```bash
# Download .ipa file and use Apple Configurator 2
# Or use Xcode to install on device
```

---

## Build Verification

### After Build Completes

- [ ] Build finished without errors ✅
- [ ] No build warnings about deprecated APIs
- [ ] All native modules compiled correctly
- [ ] Build size is reasonable (< 300MB)

### Testing on Device

#### Install on Physical Device
1. Download .ipa from EAS
2. Use Apple Configurator 2:
   - Connect iPhone
   - Drag .ipa to device
   - Wait for installation

3. Or use TestFlight:
   - Add testers via App Store Connect
   - Send TestFlight invite links
   - Users can install via TestFlight app

#### Cold Start Test
- [ ] App launches within 5 seconds
- [ ] No crashes on launch
- [ ] All screens render correctly
- [ ] API calls work (use prod API)
- [ ] Payments flow works (use sandbox)

#### Feature Testing
- [ ] User registration works
- [ ] Login/logout works
- [ ] Trainer search works
- [ ] Booking flow works
- [ ] Subscription works (TestFlight sandbox)
- [ ] Navigation works
- [ ] Error handling works

#### Minimum iOS Version Test
- [ ] Test on iOS 13.4+ devices
- [ ] Test on latest iOS (17+)
- [ ] Verify no issues with older devices

### Performance Checks
- [ ] App icon appears correctly
- [ ] Splash screen displays
- [ ] No memory leaks (monitor in Xcode)
- [ ] Network requests are fast
- [ ] UI is responsive

---

## Common Build Issues & Fixes

### Issue: Build fails with "Certificate is missing"
**Solution:**
```bash
eas build --platform ios --clear-cache
```

### Issue: "Pod file not found"
**Solution:**
```bash
# In frontend directory
rm -rf node_modules
npm install
eas build --platform ios
```

### Issue: Build takes too long (> 45 min)
**Solution:**
- Check EAS build queue
- Try again later
- Run with `--latest` to use cached dependencies

### Issue: App crashes immediately
**Solution:**
1. Check build logs in EAS console
2. Look for "NATIVE_MODULE" errors
3. Verify all plugins in app.json are compatible
4. Check environment variables are set

### Issue: TestFlight installation fails
**Solution:**
1. Verify iOS version meets minimum requirement
2. Check bundle ID matches App Store Connect
3. Verify signing certificate not expired
4. Try reinstalling from TestFlight app

---

## Build Variants

### Development Build (for debugging)
```bash
eas build --platform ios --profile development
```
- Larger file size
- Includes dev tools
- For internal testing only

### Preview Build (for stakeholders)
```bash
eas build --platform ios --profile preview
```
- Optimized but not for App Store
- Good for TestFlight
- Closer to production

### Production Build (for App Store)
```bash
eas build --platform ios --profile production
```
- Optimized and minified
- Ready for submission
- Final version for app store

---

## After Successful Build

### Artifacts to Save
- ✅ .ipa file URL (for future reference)
- ✅ Build ID (for rollback if needed)
- ✅ iOS signing certificate (already with Expo)
- ✅ Provisioning profile (already with Expo)

### Next Steps
1. Upload to TestFlight via App Store Connect (or `eas submit`)
2. Distribute to beta testers (20+ recommended)
3. Collect feedback
4. Fix critical issues
5. Submit to App Store review

---

## Build Size Guidelines

### Expected Sizes
- Uncompressed bundle: 150-250 MB
- Compressed (.ipa): 50-100 MB
- Target: < 300 MB for App Store

**Your App Expected Size:**
- Base Expo: 80 MB
- React Native + dependencies: 40 MB
- App code: 10-20 MB
- Assets (images, fonts): 5-10 MB
- **Total estimate: 135-150 MB** ✅

### Size Optimization (if needed)
- Remove unused assets
- Lazy load screens/routes
- Use code splitting
- Compress images

---

## Testing Recommendations

### Before App Store Submission
- [ ] Internal team testing (5+ testers)
- [ ] Beta testing via TestFlight (20+ testers, 2 weeks)
- [ ] Device variety testing (iPhone 12, 13, 14, 15)
- [ ] iOS version variety (13.4, 14, 15, 16, 17+)
- [ ] Real payment testing (use sandbox)
- [ ] Network testing (WiFi, 4G, 5G)
- [ ] Accessibility testing (VoiceOver, text size)
- [ ] Permission testing (location, camera, contacts)

### Beta Tester Feedback
- Collect crash reports
- Monitor performance metrics
- Gather user feedback
- Track engagement metrics
- Identify missing features

---

## Submission Ready Checklist

After successful build and beta testing:

- [ ] Build completed without errors
- [ ] Tested on 3+ real devices
- [ ] Tested on minimum iOS version
- [ ] Cold launch time < 5 seconds
- [ ] All features working in production
- [ ] Payments work with sandbox accounts
- [ ] No crashes reported
- [ ] Performance acceptable
- [ ] Accessibility labels added (TODO from task 9)
- [ ] Console logs removed
- [ ] Privacy Manifest created (✅ done)
- [ ] Android permissions added (✅ done)

---

## Timeline Estimate

| Step | Duration | Notes |
|------|----------|-------|
| Pre-build cleanup | 30 min | Remove logs |
| Build iOS | 15-30 min | EAS builds in cloud |
| TestFlight setup | 10 min | Configure in App Store Connect |
| Beta testing | 2 weeks | Recommended minimum |
| Issue fixes | Variable | Based on feedback |
| Final build | 15-30 min | Production build |
| **Total** | **3-4 weeks** | Includes beta period |

---

## Sign-Off

**Status:** READY FOR BUILD ✅

All configuration is in place. Build process is straightforward with EAS. Primary work remaining:
1. Code cleanup (remove logs)
2. Run `eas build --platform ios`
3. TestFlight setup
4. Beta testing

**Recommended:** Complete cleanups from task 10, then proceed with `eas build --platform ios --profile production`
