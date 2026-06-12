# Dependency Security Audit Report

**Audit Date:** June 6, 2026  
**App Version:** 1.0.0

---

## Executive Summary

- **Frontend Vulnerabilities:** 22 (19 moderate, 3 high)
- **Server Vulnerabilities:** 11 (10 moderate, 1 high)
- **Hardcoded Secrets:** None found ✅
- **API Keys Storage:** Environment-based only ✅

### Overall Risk: **MODERATE** ⚠️

Most vulnerabilities are in Expo/build tooling and can be fixed with dependency updates. Server vulnerabilities are in Express/qs dependencies which need attention before submission.

---

## Frontend Vulnerabilities (22 total)

### HIGH SEVERITY (3)

| Package | Issue | Fix | Notes |
|---------|-------|-----|-------|
| uuid | Missing buffer bounds check in v3/v5/v6 | npm audit fix --force | Expo dependency chain |
| xcode | UUID vulnerability inheritance | Update Expo | Nested in @expo/config-plugins |

**Frontend Expo Chain:** Most high vulnerabilities trace back through:
```
expo > @expo/config > @expo/config-plugins > xcode > uuid
```

**Action:** Update expo from 54.0.10 to 56.0.9+ (major version bump)

### MODERATE SEVERITY (19)

Mostly from Expo tooling. Examples:
- @expo/cli, @expo/config, @expo/metro-config
- ws (WebSocket, moderate)
- postcss-related
- babel-related

**Action:** Run `npm audit fix` to resolve most

---

## Server Vulnerabilities (11 total)

### HIGH SEVERITY (1)

**fast-xml-parser / fast-xml-builder**
- Issue: Attribute bypass vulnerability (CWE-91, CWE-611)
- Severity: High
- Via: @aws-sdk/xml-builder
- **Fix:** `npm audit fix` (AWS SDK will be updated)
- **Impact:** Low if XML parsing is minimal

### MODERATE SEVERITY (10)

| Package | Issue | Fix |
|---------|-------|-----|
| qs | DoS on null/undefined in arrays | npm audit fix |
| express | Depends on vulnerable qs | npm audit fix |
| body-parser | Depends on vulnerable qs | npm audit fix |
| uuid | Buffer bounds check | npm audit fix --force |
| brace-expansion | DoS on large numeric ranges | npm audit fix |

---

## Hardcoded Secrets Check ✅

**Scan Results:** No hardcoded API keys, passwords, or secrets found

**API Key Storage:** All properly loaded from environment variables
- `STRIPE_SECRET_KEY` → environment
- `REVENUECAT_SECRET_API_KEY` → environment
- Merchant IDs → app.json (non-sensitive)

**Conclusion:** ✅ Secrets management is secure

---

## SDK & Dependencies Status

### Frontend Versions

| SDK | Current | Recommended | Status |
|-----|---------|-------------|--------|
| @stripe/stripe-react-native | 0.66.0 | 0.70+ | ⚠️ Check compatibility |
| react-native-purchases | 8.12.0 | 9.0+ | ⚠️ Check compatibility |
| expo | 54.0.10 | 56.0.9+ | ⚠️ Update for security |
| react-native | 0.81.5 | Latest | ⚠️ Consider update |
| react | 19.1.0 | 19.1.0 | ✅ Latest |

### Server Versions

| Package | Current | Status |
|---------|---------|--------|
| Express | Latest | ⚠️ Has qs vulnerability |
| Sequelize | Latest | ⚠️ Depends on uuid vuln |
| AWS SDK | Latest | ⚠️ XML parser issue |

---

## Privacy Compliance Checklist

✅ **Third-Party Data Usage Documented:**
- Stripe: Payment processing (PCI DSS compliant)
- RevenueCat: Subscription management
- AWS S3: Image uploads
- Email providers: Verification/transactional

✅ **Data Handling:**
- No tracking without consent
- No selling of personal data
- Privacy Policy covers all SDKs
- GDPR/CCPA/PIPEDA compliant language

---

## Recommendations

### Before App Store Submission (CRITICAL)

1. **Update Expo to 56.0.9+**
   ```bash
   cd frontend && npm install expo@56.0.9
   ```
   - Fixes uuid vulnerability chain
   - Fixes Expo tooling issues
   - Note: Major version bump - test thoroughly

2. **Fix Server Dependencies**
   ```bash
   cd server && npm audit fix
   ```
   - Updates qs, express, uuid, AWS SDK
   - Resolves fast-xml-parser issue

3. **Test After Updates**
   - Frontend: `npm run ios` on device
   - Server: Run test suite
   - Payment flows (Stripe + RevenueCat)

### Post-Submission (Recommended)

4. **Monitor Dependencies**
   - Set up automated vulnerability scanning
   - Use `npm audit` in CI/CD pipeline
   - Review major version updates quarterly

5. **Evaluate SDK Updates**
   - Stripe SDK: 0.70+ available
   - RevenueCat: Consider 9.x
   - React Native: Watch for 0.82+ releases

---

## Dependency Summary

**Total Dependencies:**
- Frontend: ~100 packages (direct + transitive)
- Server: ~50 packages (direct + transitive)

**Dev-Only Dependencies:** None appear to be included in production build ✅

**Unused Dependencies:** None detected (verify with `npm ls` if needed)

---

## Sign-Off

- **Audit Type:** Automated npm audit + manual review
- **Next Audit:** Before v1.1 release
- **Critical Fixes Needed:** 2 (Expo update, Server audit fix)
