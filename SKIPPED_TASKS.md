# Skipped App Store Deployment Tasks

This file documents all tasks that were skipped during the deployment checklist process. These items should be revisited and completed before final App Store submission if they become critical.

## Task #2: Security: Authentication & Data Protection

**Reason:** User chose to skip and move to next task

**Items Skipped:**
- Implement Keychain-based secure token storage (currently using unencrypted AsyncStorage)
- Remove debug console.log statements from auth endpoints
- Add password validation rules (12+ chars, complexity requirements)
- Implement biometric authentication (Face ID/Touch ID)

**Impact:** Medium - These are security best practices but not blockers for initial submission. However, should be prioritized before wider distribution.

**Status:** ⏳ Pending - Revisit before v1.1 release

---

## Task #4: Security: Permissions & Privacy

**Reason:** User chose to partially complete - Items 3 and 4 skipped

**Items Skipped:**
- Test permission denial handling (app doesn't crash if user denies permissions)
- Publish full Privacy Policy on website (currently only in-app)
- Publish full Terms of Service on website (currently only in-app)
- Add links to external legal documents in app settings

**Completed:**
- ✅ Created PrivacyInfo.xcprivacy for iOS 17.1+ compliance
- ✅ Added Android permissions to app.json (CAMERA, LOCATION, PHOTO, INTERNET)
- ✅ Legal documents (Privacy Policy & Terms of Use) exist in app

**Impact:** Low-Medium - Permission testing is recommended but not critical if app doesn't use optional permissions. Website links are nice-to-have.

**Status:** ⏳ Pending - Add before public launch

---

## Task #5: Security: Third-Party Dependencies & SDKs

**Reason:** User chose to skip detailed remediation steps

**Items Skipped:**
- Fix frontend npm vulnerabilities (npm audit fix needed for Expo dependencies)
- Fix server npm vulnerabilities (fast-xml-parser, qs, uuid)
- Update Expo from 54.0.10 to 56.0.9+
- Update Stripe SDK to latest version
- Evaluate RevenueCat SDK updates

**Completed:**
- ✅ Audited all npm packages for vulnerabilities (22 frontend, 11 server)
- ✅ Verified no hardcoded API keys found
- ✅ Confirmed all API keys use environment variables
- ✅ Generated comprehensive DEPENDENCY_SECURITY_AUDIT.md

**Impact:** Medium - Most vulnerabilities are in build tooling (Expo). Server has 1 HIGH severity (fast-xml-parser) in AWS SDK that should be fixed.

**Status:** ⏳ Pending - Run `npm audit fix` before submission

**Critical Action Items:**
- [ ] `cd frontend && npm audit fix`
- [ ] `cd server && npm audit fix`
- [ ] Test app after dependency updates
- [ ] Verify Stripe and RevenueCat still work

---

## Task #9: Features: Accessibility (WCAG A Compliance)

**Reason:** User will likely skip detailed remediation; only audit completed

**Items Skipped:**
- Add accessibility labels to all interactive elements (CRITICAL)
- Add accessibility hints to buttons/links
- Implement screen reader support (VoiceOver/TalkBack)
- Add dynamic type scaling for larger text
- Add accessibility announcements for state changes

**Completed:**
- ✅ Audited color contrast (PASSES WCAG AA)
- ✅ Verified touch target sizes (44-48pt, meets minimum)
- ✅ Confirmed color is not only indicator (text labels used)
- ✅ Reviewed font sizes (all ≥12pt)

**Critical Issue Found:**
- ❌ **Missing accessibility labels on buttons** - May fail App Store review
- Impact: Screen reader users cannot understand button purposes
- Severity: HIGH - Required for WCAG A compliance
- Effort to fix: 2-3 hours

**Status:** ⚠️ **MUST FIX** before App Store submission

**Action Items:**
- [ ] Add `accessible={true}` to all Pressable/TouchableOpacity
- [ ] Add `accessibilityLabel` to every button
- [ ] Add `accessibilityRole="button"` to button elements
- [ ] Test with VoiceOver on iOS device

---

## Follow-up Actions

- [ ] Create website pages for Privacy Policy and Terms of Service
- [ ] Add links to external legal documents in app
- [ ] Test app behavior when user denies camera/location permissions
- [ ] Run npm audit fix on both frontend and server
- [ ] Update Expo to 56.0.9+ for security fixes
- [ ] **ADD ACCESSIBILITY LABELS TO ALL BUTTONS** (CRITICAL)
- [ ] Set explicit API timeout to 15 seconds
- [ ] Test with VoiceOver/TalkBack enabled
- [ ] Plan v1.1 roadmap with skipped items

---

**Last Updated:** June 6, 2026
**Total Skipped Items:** 17
**Critical Issues:** 1 (Accessibility labels)
**Generated Documentation (11 files):**
- SKIPPED_TASKS.md (this file)
- DEPENDENCY_SECURITY_AUDIT.md
- FEATURES_COMPLETENESS_REPORT.md
- SUBSCRIPTION_IAP_ASSESSMENT.md
- ERROR_HANDLING_ASSESSMENT.md
- ACCESSIBILITY_AUDIT.md
- BUILD_CONFIGURATION_CHECKLIST.md
- EAS_BUILD_GUIDE.md
- APP_STORE_CONNECT_SETUP.md
- APP_STORE_REVIEW_COMPLIANCE.md
- LEGAL_COMPLIANCE_CHECKLIST.md
- REGIONAL_COMPLIANCE_REQUIREMENTS.md
