# QA Testing Guide - Full Device Testing

**Date:** June 6, 2026  
**Duration:** 2-4 hours (thorough testing)  
**Devices Needed:** iPhone 14+ (iOS 13.4+)  
**Status:** COMPREHENSIVE CHECKLIST

---

## Pre-Testing Setup

### Device Preparation

**Device 1: Recent iPhone (iPhone 14/15/16)**
- [ ] Latest iOS version (17+)
- [ ] Clear cache before testing
- [ ] Check available storage (> 2GB free)
- [ ] Charged battery (80%+)

**Device 2: Older iPhone (iPhone 12/13 or simulator)**
- [ ] Minimum supported iOS (13.4)
- [ ] Or use Xcode simulator if device unavailable
- [ ] Check storage and battery

### App Installation

```bash
# Option A: From TestFlight (if already distributed)
1. Open TestFlight app
2. Find "Trainee"
3. Install and update to latest build

# Option B: From local build (if EAS build available)
1. Download .ipa from EAS
2. Use Apple Configurator 2 or Xcode
3. Drag .ipa to connected iPhone
4. Wait for installation

# Option C: From simulator (fastest for initial QA)
cd frontend
npm run ios  # Launches Expo on simulator
```

### Test Account Setup

**Create 2 test accounts:**

**Account 1: Client**
```
Email: test.client@example.com
Password: TestPass123!
Role: Client
Phone: +1 555-0001
```

**Account 2: Trainer**
```
Email: test.trainer@example.com
Password: TestPass123!
Role: Trainer
Phone: +1 555-0002
```

### Network Throttling Setup (for slow network test)

**iOS Settings:**
```
Settings → Developer (if available)
or
Xcode → Devices → Simulator → Custom Network Link Conditioner
```

**Network Profiles to Test:**
- WiFi (baseline)
- LTE/4G (good)
- 3G (slow - throttle to ~5 Mbps)
- 2G (very slow - throttle to ~0.5 Mbps)

---

## Test Categories

---

# CATEGORY 1: Authentication & Account Management

## Test 1.1: User Registration

**Steps:**
1. Open app
2. Tap "Sign Up"
3. Enter:
   - Email: test.newuser@example.com
   - First Name: Test
   - Last Name: User
   - Phone: +1 555-0003
   - Password: SecurePass123!
   - Role: Client
4. Tap "Sign Up"

**Expected Results:**
- ✅ Form validates (password strength check)
- ✅ Email uniqueness checked
- ✅ Success screen shows
- ✅ Auto-login after signup
- ✅ Home screen appears

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 1.2: User Login

**Steps:**
1. If logged in, logout first
2. Tap "Login"
3. Enter email: test.client@example.com
4. Enter password: TestPass123!
5. Tap "Login"

**Expected Results:**
- ✅ Form shows email field, password field
- ✅ Login button disabled until both filled
- ✅ Loading spinner appears
- ✅ Home screen shown after login
- ✅ User name appears in navigation

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 1.3: Logout

**Steps:**
1. While logged in, find logout button (usually in profile/settings)
2. Tap logout
3. Confirm logout

**Expected Results:**
- ✅ Logged out successfully
- ✅ Returned to login screen
- ✅ User data cleared from memory
- ✅ Cannot access protected screens

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 1.4: Password Reset

**Steps:**
1. On login screen, tap "Forgot Password"
2. Enter email: test.client@example.com
3. Tap "Reset Password"
4. Check email for reset link
5. Click link (may open in browser)
6. Enter new password: NewPass456!
7. Save new password

**Expected Results:**
- ✅ "Check your email" message appears
- ✅ Email received within 2 minutes
- ✅ Reset link valid
- ✅ New password accepted
- ✅ Can login with new password

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 1.5: Session Persistence

**Steps:**
1. Login
2. Close app (swipe up/home button)
3. Reopen app
4. Wait 5 seconds for app to load

**Expected Results:**
- ✅ Still logged in
- ✅ Previous screen restored
- ✅ No need to re-login
- ✅ User data preserved

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 1.6: Token Refresh (Advanced)

**Steps:**
1. Login successfully
2. Keep app open for 30+ minutes
3. Try to perform API action (search trainers, book, etc.)
4. App should silently refresh token

**Expected Results:**
- ✅ API call succeeds
- ✅ No "session expired" error
- ✅ No need to re-login
- ✅ User doesn't notice token refresh

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 2: Trainer Search & Discovery

## Test 2.1: Trainer Search

**Steps:**
1. Login as client
2. Tap "Search" or "Trainers" tab
3. See list of trainers (or search option)
4. Scroll through list
5. Observe trainer cards

**Expected Results:**
- ✅ Trainers list appears (or empty if none)
- ✅ Each card shows: name, photo, rating, location
- ✅ Smooth scrolling
- ✅ No crashes on scroll

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 2.2: Filter by Specialization

**Steps:**
1. On trainers list, tap filter/search icon
2. Select specialization (e.g., "Yoga", "Strength Training")
3. Observe results update

**Expected Results:**
- ✅ Filter options appear
- ✅ Results filtered correctly
- ✅ Only selected specialization shows
- ✅ Count updates

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 2.3: View Trainer Profile

**Steps:**
1. Tap any trainer card
2. View full profile
3. Scroll to see all info
4. Look for: bio, rates, specializations, reviews, rating

**Expected Results:**
- ✅ Full profile loads
- ✅ Profile photo displays
- ✅ Bio/description visible
- ✅ Hourly/session rates shown
- ✅ Star rating visible
- ✅ Reviews section appears
- ✅ "Book Session" button present

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 2.4: Map View

**Steps:**
1. Find map icon (if available)
2. Tap to view trainers on map
3. Zoom in/out
4. Tap trainer marker

**Expected Results:**
- ✅ Map loads with markers
- ✅ Trainers appear as pins
- ✅ Location accurate
- ✅ Tap marker shows trainer info
- ✅ Tap info opens full profile

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 3: Trainer Profile Management (Trainer Role)

## Test 3.1: Create Trainer Profile

**Steps (as trainer user):**
1. Signup as trainer role
2. Should auto-open trainer profile creation
3. Fill in:
   - Bio: "Experienced fitness coach"
   - Experience: 5 years
   - Hourly Rate: $50
   - Session Rate: $100
   - Location: Current city
   - Specializations: Pick 2-3
4. Upload profile photo
5. Tap "Save"

**Expected Results:**
- ✅ Form validates (required fields)
- ✅ Photo upload works
- ✅ Profile saves successfully
- ✅ Success message appears
- ✅ Profile visible to clients

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 3.2: Edit Trainer Profile

**Steps:**
1. Tap profile/settings
2. Edit trainer profile
3. Change: bio, rates, location
4. Upload new photo
5. Save changes

**Expected Results:**
- ✅ All editable fields work
- ✅ Photo update works
- ✅ Changes saved
- ✅ Public profile updates immediately
- ✅ No duplicate info

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 3.3: Set Availability

**Steps:**
1. Tap "Schedule" or "Availability"
2. Set working hours for this week:
   - Monday: 9 AM - 5 PM
   - Wednesday: 10 AM - 6 PM
   - Friday: 8 AM - 4 PM
3. Set session duration: 60 minutes
4. Save

**Expected Results:**
- ✅ Working hours saved
- ✅ Available time slots generated
- ✅ Calendar shows availability
- ✅ Clients can see slots

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 4: Booking & Scheduling

## Test 4.1: View Available Sessions (As Client)

**Steps:**
1. Login as client
2. Find a trainer with availability
3. Tap "Book Session" or view availability
4. See calendar with available slots

**Expected Results:**
- ✅ Calendar appears
- ✅ Green/available slots visible
- ✅ Booked slots appear unavailable
- ✅ Can tap on available slot
- ✅ Session details show (time, duration, price)

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 4.2: Book a Session

**Steps:**
1. Select available time slot
2. Confirm booking
3. See confirmation screen

**Expected Results:**
- ✅ Booking confirmation appears
- ✅ Session time confirmed
- ✅ Trainer name shown
- ✅ Location/virtual meeting info provided
- ✅ Booking reference shown

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 4.3: View Booked Sessions (Client)

**Steps:**
1. Go to "My Sessions" or "Bookings"
2. See upcoming sessions

**Expected Results:**
- ✅ Booked session appears in list
- ✅ Shows: trainer name, date, time, location
- ✅ Can tap for details
- ✅ Cancel button available (if not started)

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 4.4: View Bookings (Trainer)

**Steps:**
1. Login as trainer
2. Go to "My Bookings" or "Schedule"
3. See client bookings

**Expected Results:**
- ✅ Booked sessions appear
- ✅ Client name, date, time visible
- ✅ Can tap for more details
- ✅ Check-in code available

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 4.5: Cancel Booking

**Steps:**
1. On a booking, tap "Cancel"
2. Confirm cancellation
3. Observe result

**Expected Results:**
- ✅ Confirmation prompt appears
- ✅ After confirmation, booking removed
- ✅ Success message shown
- ✅ Slot becomes available again for other clients
- ✅ Trainer can re-book that slot

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 4.6: Session Check-In (Trainer)

**Steps:**
1. Trainer views upcoming booking
2. Taps "Generate Check-in Code" or similar
3. Code appears (or refreshes)
4. Tap to copy code
5. Share with client or display at session

**Expected Results:**
- ✅ Check-in code appears
- ✅ Code is unique
- ✅ Code can be copied
- ✅ Code has expiration time
- ✅ Code validates on entry

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 5: Reviews & Ratings

## Test 5.1: Submit Review

**Steps:**
1. After a session, find option to review trainer
2. Tap "Write Review" or star rating
3. Fill in:
   - Rating: 5 stars
   - Comment: "Great session!"
4. Submit review

**Expected Results:**
- ✅ Review form appears
- ✅ Star rating selector works
- ✅ Comment field editable
- ✅ Submit button enabled
- ✅ Success message after submit

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 5.2: View Reviews

**Steps:**
1. Open trainer profile
2. Scroll to "Reviews" section
3. See all reviews

**Expected Results:**
- ✅ Reviews appear in list
- ✅ Each review shows: rating, comment, date, reviewer name
- ✅ Average rating displayed
- ✅ Review count shown

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 5.3: Edit/Delete Review

**Steps:**
1. Find your own review
2. Tap edit or delete
3. Make change or confirm deletion

**Expected Results:**
- ✅ Can edit own review
- ✅ Can delete own review
- ✅ Cannot edit/delete others' reviews
- ✅ Changes reflected immediately

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 6: Payments & Subscriptions

## Test 6.1: View Subscription Status

**Steps:**
1. Login as trainer
2. Go to Settings/Billing or Subscription tab
3. View current subscription status

**Expected Results:**
- ✅ Subscription status visible (active, trial, canceled, past due)
- ✅ Renewal date shown
- ✅ Current plan displayed
- ✅ Price shown (RON 100.00/month)

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 6.2: Purchase Subscription (Sandbox)

**Steps:**
1. Open checkout screen
2. Select plan: "Premium Trainer Access"
3. Tap "Subscribe Now"
4. Complete payment (use sandbox test account)
5. See success screen

**Expected Results:**
- ✅ Plan selection works
- ✅ "Subscribe Now" button functional
- ✅ Payment screen appears
- ✅ No actual charge (sandbox)
- ✅ Subscription activated after payment
- ✅ Status updates to "Active"

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 6.3: Restore Purchases

**Steps:**
1. On subscription screen, tap "Restore Purchases"
2. Confirm restoration

**Expected Results:**
- ✅ "Restoring..." indicator appears
- ✅ Previous subscription recognized
- ✅ Entitlement synced to account
- ✅ Status updates
- ✅ Success message

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 6.4: View Transaction History

**Steps:**
1. On billing screen, scroll to "Payment History"
2. See transaction list

**Expected Results:**
- ✅ Transactions appear in chronological order
- ✅ Each shows: date, amount, provider (Apple/Google), status
- ✅ Can scroll through history
- ✅ Empty state if no transactions

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 7: Network & Performance

## Test 7.1: Slow Network (3G)

**Steps:**
1. Enable 3G throttling in settings
2. Load trainer list
3. Search trainers
4. Open trainer profile
5. Observe load times

**Expected Results:**
- ✅ Loading spinner appears
- ✅ Content loads within 5 seconds
- ✅ No timeout/error
- ✅ UI remains responsive
- ✅ User can cancel if needed

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 7.2: Very Slow Network (2G)

**Steps:**
1. Enable 2G throttling
2. Perform simple action (view profile)
3. Observe behavior

**Expected Results:**
- ✅ Long load time acceptable (10-20 sec)
- ✅ Loading indicator present
- ✅ No app freeze
- ✅ Error handling if truly fails
- ✅ Retry option available

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 7.3: Network Failure

**Steps:**
1. Disable WiFi and cellular
2. Try API call (search, book, payment)
3. Observe error handling

**Expected Results:**
- ✅ Error message shown (not crash)
- ✅ "No internet" message clear
- ✅ "Retry" button available
- ✅ App doesn't freeze

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 7.4: Cold App Launch Time

**Steps:**
1. Force close app (Settings > app > Force Close)
2. Open app
3. Measure time until first screen visible
4. Repeat 3 times

**Expected Results:**
- ✅ First launch: < 5 seconds typically
- ✅ Subsequent: < 2 seconds
- ✅ No black screen delays
- ✅ Splash screen visible

**Actual Results:**
- [ ] Passed / [ ] Failed
- Launch times: _____ sec, _____ sec, _____ sec

---

## Test 7.5: App Backgrounding

**Steps:**
1. Login and navigate to profile screen
2. Press home button (app goes background)
3. Wait 30 seconds
4. Reopen app (tap icon)

**Expected Results:**
- ✅ App resumes to previous screen
- ✅ Data preserved
- ✅ No re-login needed
- ✅ Smooth transition

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 8: Edge Cases & Error Handling

## Test 8.1: Empty States

**Steps:**
1. Create new user with no bookings
2. Go to "My Sessions"
3. Observe empty state

**Expected Results:**
- ✅ "No sessions yet" message appears
- ✅ Message is friendly, not technical
- ✅ App doesn't crash
- ✅ Link to book first session offered

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 8.2: Invalid Input

**Steps:**
1. Go to login
2. Try invalid email: "notanemail"
3. Try empty password: ""
4. Observe validation

**Expected Results:**
- ✅ "Invalid email" error shown
- ✅ Submit button disabled until valid
- ✅ Error messages helpful (not generic)
- ✅ No crash on validation failure

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 8.3: Force Quit & Data Persistence

**Steps:**
1. Open app
2. Book a session (or perform action)
3. Force quit app (Settings > app > Force Close)
4. Reopen app
5. Check if booking still exists

**Expected Results:**
- ✅ Booking persists after force quit
- ✅ Data not lost
- ✅ Can access booked session
- ✅ No data corruption

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 8.4: Low Battery Mode

**Steps:**
1. Enable "Low Power Mode" (Settings > Battery)
2. Use app normally
3. Perform several actions

**Expected Results:**
- ✅ App still functions
- ✅ No crashes in low battery mode
- ✅ Performance acceptable
- ✅ Background tasks respect mode

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 8.5: Low Storage

**Steps:**
1. Fill device with large files (or simulate)
2. Try to upload profile photo
3. Observe error handling

**Expected Results:**
- ✅ Clear error message if storage full
- ✅ No corrupt files
- ✅ App remains stable
- ✅ Helpful message about clearing space

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 9: Permissions & Privacy

## Test 9.1: Camera Permission

**Steps:**
1. Go to profile photo upload
2. Try to take photo
3. First time: allow permission
4. Observe camera opens
5. Take photo

**Expected Results:**
- ✅ Permission prompt appears first time
- ✅ Clear explanation shown
- ✅ Camera opens if allowed
- ✅ Photo captured and uploaded

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 9.2: Camera Permission - Deny

**Steps:**
1. Reset app permissions (Settings > app > Camera = Don't Allow)
2. Try to upload photo from camera
3. Tap to take new photo

**Expected Results:**
- ✅ "Camera access denied" message
- ✅ App doesn't crash
- ✅ Can still upload from library
- ✅ User understands what to do

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 9.3: Location Permission

**Steps:**
1. Go to trainer search/map
2. Try location-based feature
3. First time: allow permission

**Expected Results:**
- ✅ Permission prompt appears
- ✅ Clear explanation shown
- ✅ If allowed: location used
- ✅ Map shows nearby trainers

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 9.4: Location Permission - Deny

**Steps:**
1. Reset location permission (Deny)
2. Try to use location features

**Expected Results:**
- ✅ "Location access denied" message
- ✅ App gracefully handles denial
- ✅ Can still search trainers (without location)
- ✅ Doesn't crash

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# CATEGORY 10: Device-Specific

## Test 10.1: Different Screen Sizes

**Steps (if testing on multiple devices):**
1. Test on iPhone 12 (smaller)
2. Test on iPhone 15 Pro (larger)
3. Compare layouts

**Expected Results:**
- ✅ UI scales properly
- ✅ No overlapping elements
- ✅ Text readable on both
- ✅ Buttons/forms properly sized (44pt minimum)
- ✅ No horizontal scrolling needed

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues on device: _____________

---

## Test 10.2: Minimum iOS Version (13.4)

**Steps:**
1. Test on older iOS device or simulator
2. Run through main flows

**Expected Results:**
- ✅ App installs on iOS 13.4
- ✅ All features work
- ✅ No crashes from API misuse
- ✅ Performance acceptable

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Test 10.3: Latest iOS Version (17+)

**Steps:**
1. Test on latest iOS available
2. Run through all features

**Expected Results:**
- ✅ Fully compatible
- ✅ Uses new iOS features if available
- ✅ No deprecation warnings
- ✅ Performance good

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

# SUMMARY & BUG REPORT

## Overall Test Results

| Category | Pass | Fail | Notes |
|----------|------|------|-------|
| Authentication | ☐ | ☐ | |
| Search/Discovery | ☐ | ☐ | |
| Trainer Management | ☐ | ☐ | |
| Booking/Scheduling | ☐ | ☐ | |
| Reviews/Ratings | ☐ | ☐ | |
| Payments | ☐ | ☐ | |
| Network/Performance | ☐ | ☐ | |
| Edge Cases | ☐ | ☐ | |
| Permissions | ☐ | ☐ | |
| Device-Specific | ☐ | ☐ | |

## Critical Issues Found

1. **Issue:** _________________
   - **Severity:** Critical / High / Medium / Low
   - **Steps to reproduce:** 
   - **Expected:** 
   - **Actual:**
   - **Impact:** Blocks submission? Yes/No

2. **Issue:** _________________
   - **Severity:** 
   - **Steps to reproduce:** 
   - **Expected:** 
   - **Actual:**
   - **Impact:** 

## Minor Issues Found

1. _________________
2. _________________
3. _________________

## Recommendation

- [ ] **Ready for submission** - No critical issues
- [ ] **Fix issues first** - Critical issues found
- [ ] **Needs retesting** - After fixes applied

---

## Sign-Off

**Date Tested:** __________  
**Tester Name:** __________  
**Device(s) Used:** __________  
**iOS Version(s):** __________  
**Overall Status:** ✅ / ⚠️ / ❌

**Notes:**

