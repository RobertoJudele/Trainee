# TestFlight Beta Testing Guide

**Duration:** 2 weeks minimum  
**Testers Needed:** 20-50 external testers  
**Focus:** Real-world usage, crash detection, UX feedback

---

## What is TestFlight?

Apple's beta testing platform:
- Distribute pre-release builds to testers
- Automatic crash reporting
- Feedback collection
- Version management
- Over-the-air updates

---

## Preparation Phase (1-2 days before launch)

### Step 1: Build for TestFlight

```bash
cd frontend
eas build --platform ios --profile preview
```

**Result:**
- Build uploaded to EAS
- Can then submit to TestFlight from App Store Connect

### Step 2: Create TestFlight Submission

**In App Store Connect:**
1. Navigate to your app
2. TestFlight tab
3. Click "+" to add new build
4. Select your iOS build
5. Fill in test information:
   ```
   Beta App Review Information:
   - Sign-in required? No
   - Beta ID/password? No
   - Special setup needed? No
   
   Test Notes (internal):
   "Testing core features: auth, search, booking, payments.
   Focus on crashes and performance."
   ```

### Step 3: Configure Test Groups

**Create External Testing Group:**
1. TestFlight → External Testing
2. Create Group: "General Beta"
3. Description: "All core features"
4. Build: Select your latest build

**Create Internal Testing Group:**
1. Add your own team members (5-10 people)
2. Internal testers get immediate access
3. No review needed
4. For quick feedback

---

## Recruitment Phase (Weeks 1-2)

### Identify Testers

**Recruit from:**
- Friends & family (5-10)
- Beta community (5-10)
- LinkedIn connections (5-10)
- Reddit fitness communities (5-10)
- Work colleagues (5-10)

**Total Target:** 20-30 initial testers

### Sample Recruitment Email

```
Subject: Help Test Trainee Beta - Fitness App

Hi [Name],

I'm developing Trainee, a new app to connect 
people with fitness trainers. Would you be willing 
to be a beta tester for 2 weeks?

What you'll do:
- Install the app via Apple's TestFlight
- Use it like normal for 2 weeks
- Report any bugs or issues
- Give feedback on usability

Time commitment: 30 min-1 hour during beta period

Interested? Reply with your Apple ID email address.

Thanks,
[Your Name]
```

### Invite Testers via TestFlight

**In App Store Connect:**
1. TestFlight → External Testing → [Your Group]
2. Click "+" to invite testers
3. Enter Apple ID email addresses
4. Include test notes

**Testers receive:**
- TestFlight app notification
- Email invitation
- Installation instructions
- Access to latest build

---

## Testing Phase (2 weeks)

### Week 1: Initial Testing & Bug Hunting

**Day 1-2: Installation & Setup**
- All testers install app
- Create test accounts
- Perform basic testing
- Report installation issues

**Day 3-7: Deep Testing**
- Test all major features
- Report crashes
- Report UI issues
- Test on various iOS versions

**Collect Feedback:**
- In-app feedback form
- Email to: larisasfirlea@gmail.com
- Or TestFlight feedback tab

### Week 2: Bug Fixes & Retesting

**Day 8-10:**
- Fix critical bugs reported
- Submit new build via EAS
- TestFlight auto-distributes to testers
- Testers retest fixes

**Day 11-14:**
- Final verification of fixes
- Collect final feedback
- Monitor crash reports
- Prepare for submission

---

## Monitoring During Beta

### Track Crashes in App Store Connect

**In App Store Connect:**
1. TestFlight → [Your app/build]
2. Crashes tab
3. View:
   - Total crashes
   - Crash rate
   - Affected testers
   - Stack traces (help fix issues)

**Action on Crashes:**
```
Crash rate > 1%:        CRITICAL - fix before submit
Crash rate 0.1-1%:      HIGH - should fix
Crash rate < 0.1%:      LOW - acceptable or fix later
```

### Monitor Feedback

**Feedback Channels:**
1. TestFlight in-app feedback button
2. Email at larisasfirlea@gmail.com
3. Direct messages from testers

**Sample Feedback Template (send to testers):**
```
Bug Report Template:
- What was happening: [describe action]
- What went wrong: [what happened]
- Expected: [what should happen]
- Device/iOS: [iPhone model, iOS version]
- When it happened: [steps to reproduce]
- Screenshot: [attach if possible]
```

### Expected Feedback Categories

| Type | Example | Action |
|------|---------|--------|
| Crash | "App crashes on login" | Critical - fix immediately |
| Bug | "Typo in trainer profile" | Medium - fix before submit |
| UX | "Button too hard to tap" | Low - note for v1.1 |
| Feature | "Can't upload video" | N/A - out of scope v1.0 |

---

## Testing Checklist (for Testers to Follow)

**Send this to each beta tester:**

```
=== TRAINEE BETA TESTING CHECKLIST ===

Thank you for testing! Please work through these steps 
and report any issues.

ACCOUNT & AUTH
☐ Create new account (client role)
☐ Login works
☐ Logout works
☐ Password reset works
☐ Logout, clear app, reopen - still logged in

SEARCH & DISCOVERY
☐ Search trainers works
☐ Filter by specialization works
☐ View trainer profile works
☐ Trainer photos display correctly
☐ Ratings/reviews visible

BOOKING
☐ Find trainer with availability
☐ Book a session
☐ Confirm booking appears in "My Sessions"
☐ Can view booking details
☐ Can cancel booking

PAYMENTS
☐ Open subscription page
☐ Select plan
☐ Tap "Subscribe"
☐ Complete payment (no charge in sandbox)
☐ Subscription confirmed

GENERAL
☐ App never crashed
☐ No error messages (besides expected ones)
☐ Buttons responsive
☐ Text readable
☐ No confusing navigation

ISSUES FOUND:
1. [Describe issue]
2. [Describe issue]

FEEDBACK:
[What did you think? Any suggestions?]

Device: iPhone 14
iOS: 17.1
Date: June 20, 2026
```

---

## Bug Prioritization During Beta

### Critical (Fix Immediately)
- App crashes frequently
- Crashes on core features (booking, payment)
- Data loss
- Can't complete signup/login
- Payment doesn't process

**Action:** Build hotfix, re-submit immediately

### High (Fix Before Submission)
- App crashes occasionally (1-5 times per tester)
- Core feature doesn't work
- Major UX issue preventing use
- Security vulnerability

**Action:** Include in next build, retest

### Medium (Fix if Time)
- Minor UI glitch
- Typos/grammar
- Non-critical feature broken
- One-time crash with clear workaround

**Action:** Include in next build or v1.1

### Low (For v1.1)
- Feature request
- UI enhancement
- Cosmetic issue
- Workaround exists

**Action:** Document for future release

---

## Fix & Rebuild Process

**When critical bugs found:**

1. **Identify issue** (from crash report/feedback)
2. **Fix code** (in your repo)
3. **Build new version:**
   ```bash
   cd frontend
   # Increment build number in app.json
   eas build --platform ios --profile preview
   ```
4. **Submit to TestFlight** (via App Store Connect)
5. **Testers auto-update** (within 1 hour)
6. **Retest** (verify fix works)

---

## Daily Check-in Routine

**Every morning during beta (2 weeks):**

1. Check crash reports in App Store Connect
2. Read new feedback/emails
3. Prioritize issues
4. Assign fixes
5. Plan new builds if needed

**Daily Report Template:**
```
Date: June 20, 2026
Testers Active: 25/30
Crash Rate: 0.1% (healthy)
Critical Bugs: 0
High Priority Bugs: 1 (login delay)
Feedback Summary: "Great UX, minor lag on slow WiFi"
Plan: Build hotfix for login delay tomorrow
```

---

## Test Plan by iOS Version

### iOS 13.4 (Minimum)
- [ ] Installs on iOS 13.4
- [ ] All core features work
- [ ] No API compatibility issues
- [ ] Performance acceptable (>2 testers)

### iOS 14-15 (Common)
- [ ] Installs and works normally
- [ ] All features functional
- [ ] Good performance
- [ ] (5-10 testers)

### iOS 16 (Current -1)
- [ ] Works perfectly
- [ ] Modern features available
- [ ] Optimal performance
- [ ] (5-10 testers)

### iOS 17+ (Latest)
- [ ] Tested on latest available
- [ ] Uses new APIs if available
- [ ] No deprecation warnings
- [ ] (5-10 testers)

---

## Language & Regional Testing

**Test Locations:**
- [ ] English (US/UK)
- [ ] Spanish
- [ ] German (if EU focused)
- [ ] Romanian (if targeting Romania)
- [ ] French

**Check for:**
- Text truncation
- Right-to-left language issues
- Date/time format
- Currency display

---

## Post-Beta Summary Report

**After 2 weeks, compile:**

```
TESTFLIGHT BETA SUMMARY
======================
Duration: June 15-29, 2026
Testers: 25 (started) / 15 (active throughout)
Retention: 60%

CRASHES
- Total crashes: 3
- Crash rate: 0.05% (excellent)
- Most common: [Login screen on iOS 14] (fixed)

CRITICAL BUGS
- None found after fix on day 5

HIGH PRIORITY BUGS
- Login delay on 3G (fixed in v2 build)

MEDIUM PRIORITY BUGS
- Typo in profile section (noted for v1.1)

TESTER FEEDBACK
- "Love the design" (3 mentions)
- "Performance excellent" (2 mentions)
- "Lag on slow WiFi" (2 mentions)
- "Needs more trainer options" (feature request)

RATING ESTIMATE
- If submitted now, likely: 4.5+ stars

RECOMMENDATION
Fix high-priority bugs, then ready for submission.
```

---

## Decision: Ready for App Store?

**Green Light (Submit):**
✅ Crash rate < 0.1%
✅ No critical bugs
✅ Core features verified
✅ Tester feedback positive
✅ Performance acceptable

**Yellow Light (Fix First):**
⚠️ Crash rate 0.1-1%
⚠️ 1-2 high priority bugs
⚠️ Mixed tester feedback
→ Build fix, retest 3-5 days, then submit

**Red Light (Not Ready):**
❌ Crash rate > 1%
❌ Critical bugs
❌ Core features broken
❌ Negative feedback
→ Fix issues, retest 1-2 weeks, then reassess

---

## Template: TestFlight Communication

### Initial Invitation Email
```
Subject: Test Trainee Beta - 2-Week Test Drive

Hi [Name],

Thank you for agreeing to beta test Trainee! 
Here's how it works:

1. Check your email for TestFlight invitation
2. Tap the link and install Trainee from TestFlight
3. Test the app for 2 weeks
4. Report any issues via email or in-app feedback
5. Enjoy using the app!

What to test:
- Create account, login, logout
- Search trainers in your area
- Book a session
- Subscribe (no charge, it's sandbox)
- General usability and crashes

Questions? Email: larisasfirlea@gmail.com

Thanks for helping us launch!
[Your Name]
```

### Mid-Beta Update Email
```
Subject: Trainee Beta - Update & Bug Fix

Hi Beta Testers,

Thank you for the great feedback! We found and 
fixed a critical login issue based on your reports.

New build just released - you'll get it automatically 
within 1 hour.

Please retest the login flow and confirm it works now.

Thanks,
[Your Name]
```

### Final Email
```
Subject: Trainee Beta - Final Week!

Hi Testers,

We're entering the final week of beta testing. 
Your feedback has been invaluable!

Final push: Please test heavily this week so we 
can catch any last-minute issues.

Excited to launch next week. Thank you!

[Your Name]
```

---

## Sign-Off

**Beta Testing is crucial for:**
- Finding bugs before 1M+ users
- Validating core features work at scale
- Gathering real-world feedback
- Building confidence before submission
- Getting initial reviews/ratings

**Expected Outcomes:**
- 0-10 crashes total during 2 weeks
- 0 critical bugs remaining
- 1-3 high priority bugs identified & fixed
- 95%+ satisfaction from testers
- Ready for App Store submission

