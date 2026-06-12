# Payment Processing Verification Guide

**Critical for:** Revenue protection, compliance, user trust  
**Duration:** 1-2 hours  
**Scope:** All payment flows in sandbox/test environment

---

## Important: TEST MODE ONLY

⚠️ **Never test with real payment methods on production!**

All testing uses:
- TestFlight sandbox accounts (no real charges)
- Stripe test keys (not production)
- RevenueCat sandbox (not production)
- No real money involved

---

## Part 1: RevenueCat In-App Purchase (IAP) Testing

### Setup

**1. Create Sandbox Tester Account**

In App Store Connect:
1. Users and Access → Sandbox Testers
2. Click "+" to add new
3. Fill in:
   ```
   First Name: Test
   Last Name: IAP
   Email: test.iap@example.com
   Password: TestPass123!
   Secret Question: Your favorite color?
   Secret Answer: Blue
   ```
4. Select region/country
5. Save

**2. Install App via TestFlight**

Using the sandbox account (not your own Apple ID):
1. Open TestFlight
2. Install Trainee build
3. Sign out of App Store (if signed in)
4. Don't sign in with sandbox account yet

### Test Case 1: Purchase Subscription

**Steps:**
1. Open Trainee
2. Login with regular test account (test.trainer@example.com)
3. Go to checkout/subscription screen
4. Tap "Subscribe Now"
5. App opens App Store payment screen
6. Confirm purchase attempt
7. System prompts for Apple ID
8. **Sign in with sandbox account** (test.iap@example.com)
9. Complete purchase

**Expected Results:**
- ✅ Payment screen appears (App Store)
- ✅ No real charge (sandbox)
- ✅ Confirmation appears
- ✅ Subscription status updates to "Active"
- ✅ Price shown: RON 100/month (or equivalent)
- ✅ Renewal date displayed

**Verification:**
- [ ] Subscription shows "Active"
- [ ] Renewal date is 1 month from now
- [ ] Billed via "Apple App Store"
- [ ] Can see subscription in settings

**Check Backend:**
- Login to dashboard/API
- Verify transaction recorded
- Check RevenueCat sync completed

---

### Test Case 2: Subscription State Verification

**Steps:**
1. With active subscription, go to subscription screen
2. Verify all details

**Expected Results:**
- ✅ Status: "Active (Auto-renewing)"
- ✅ Next renewal: [date 1 month away]
- ✅ Amount: RON 100.00/month
- ✅ "Manage Subscription" button works
- ✅ "Restore Purchases" button present

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 3: Restore Purchases

**Steps:**
1. Go to subscription screen
2. Tap "Restore Purchases"
3. Wait for sync

**Expected Results:**
- ✅ Loading indicator appears
- ✅ "Restoring purchases..." message
- ✅ Completes within 5 seconds
- ✅ Subscription status confirmed
- ✅ Success message

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 4: Cancel & Resubscribe

**Steps:**
1. From subscription screen, tap "Manage Subscription"
2. Opens App Store subscription management
3. Tap "Cancel Subscription" (via App Store)
4. Confirm cancellation
5. Return to app
6. Refresh subscription status
7. See status: "Canceled"
8. Tap "Subscribe Now" to re-subscribe
9. Complete purchase again

**Expected Results:**
- ✅ Cancellation reflected in app
- ✅ Status changes to "Canceled"
- ✅ Expiration date shows
- ✅ Re-subscription works cleanly
- ✅ No "already in use" error
- ✅ New active subscription confirmed

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 5: Trial Period (if configured)

**Steps:**
1. Delete app/clear data
2. Reinstall fresh
3. Create new account
4. Go to subscription
5. Should show "7-day free trial" or similar

**Expected Results:**
- ✅ Trial period displayed
- ✅ Duration shown: "7 days free"
- ✅ Then charges RON 100/month
- ✅ Trial cancellable anytime

**Note:** Only test if trial is configured in RevenueCat

**Actual Results:**
- [ ] Passed / [ ] Failed
- [ ] Not configured / N/A
- Issues: _____________

---

### Test Case 6: Receipt Validation (Backend)

**Steps:**
1. Complete subscription purchase in TestFlight
2. Check backend logs
3. Verify RevenueCat sync occurred

**Check in backend:**
```
GET /billing/entitlement
Expected response:
{
  "success": true,
  "data": {
    "isActive": true,
    "status": "active",
    "source": "apple",
    "expiresAt": "2026-07-06T..."
  }
}
```

**Verify in Database:**
- Check `billing_entitlements` table
- Verify `source = "apple"`
- Verify `is_active = true`
- Verify `expires_at` is correct

**Actual Results:**
- [ ] Passed / [ ] Failed
- Receipt validation: ___________

---

## Part 2: Stripe Web Checkout (if enabled)

### Setup

**1. Enable Stripe in app.json**
```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_ENABLE_STRIPE_CHECKOUT": "1"
    }
  }
}
```

**2. Use Stripe Test Keys**
- Public key: `pk_test_xxxxx` (already configured)
- Secret key: `sk_test_xxxxx` (backend only)

### Test Case 1: Stripe Test Card

**Steps:**
1. Open app on web (if applicable)
2. Go to checkout/subscription
3. Click "Checkout with Stripe"
4. Payment form appears
5. Enter test card:
   ```
   Card Number: 4242 4242 4242 4242
   Expiry: 12/25 (future date)
   CVC: 123
   ```
6. Complete payment

**Expected Results:**
- ✅ Payment form loads
- ✅ Card accepted (test mode)
- ✅ No real charge
- ✅ Confirmation page
- ✅ Subscription active

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 2: Failed Payment (Stripe)

**Steps:**
1. Enter test card that declines:
   ```
   Card: 4000 0000 0000 0002
   Expiry: 12/25
   CVC: 123
   ```
2. Attempt payment
3. Observe error handling

**Expected Results:**
- ✅ Payment declined message
- ✅ Clear error explanation
- ✅ "Try again" option
- ✅ Not charged
- ✅ No crash

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 3: Stripe Billing Portal

**Steps:**
1. From subscription screen, tap "Manage Billing"
2. Opens Stripe billing portal
3. Can view invoice history
4. Can download invoices

**Expected Results:**
- ✅ Portal loads
- ✅ Transactions visible
- ✅ Can manage payment method
- ✅ Can update billing info

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Part 3: Error Handling

### Test Case 1: Network Failure During Payment

**Steps:**
1. Simulate network disconnection
2. Start payment process
3. Kill network mid-payment
4. Observe handling

**Expected Results:**
- ✅ Network error message
- ✅ "Retry" button
- ✅ No charge if network failed
- ✅ Can retry when online

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 2: Timeout During Payment

**Steps:**
1. Throttle to very slow network
2. Start payment
3. Wait for timeout (~15 seconds)

**Expected Results:**
- ✅ Timeout message
- ✅ "Retry" option
- ✅ No partial charge
- ✅ Clean error state

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 3: Server Error

**Steps:**
1. Complete payment successfully
2. Check backend doesn't return error
3. Simulate server error (if you can)
4. Retry payment

**Expected Results:**
- ✅ Server error handled
- ✅ User sees helpful message
- ✅ Retry works
- ✅ No duplicate charge

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 4: Data Validation

**Steps:**
1. Attempt payment with invalid data
2. Try empty form fields
3. Try malformed email
4. Observe validation

**Expected Results:**
- ✅ Validation errors shown
- ✅ Submit button disabled
- ✅ Clear error messages
- ✅ No API call with bad data

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Part 4: Security Verification

### Test Case 1: No Payment Data Logged

**Steps:**
1. Complete payment
2. Check app logs: `console.log` statements
3. Check backend logs
4. Search for: card numbers, amounts, sensitive data

**Expected Results:**
- ✅ No card numbers in logs
- ✅ No payment amounts logged
- ✅ No tokens exposed
- ✅ Only successful/failed status logged

**Check:**
```
❌ "Card: 4242..." - FAIL
❌ "Amount: $50" - FAIL
✅ "Payment processed successfully" - PASS
✅ "Payment failed: declined" - PASS
```

**Actual Results:**
- [ ] Passed / [ ] Failed
- Security issues: _____________

---

### Test Case 2: HTTPS Only

**Steps:**
1. Monitor network traffic
2. Complete payment
3. Verify all communication encrypted

**Expected Results:**
- ✅ All API calls use HTTPS
- ✅ Certificate valid
- ✅ No HTTP calls
- ✅ No sensitive data in URL

**Check in Network Tab:**
```
✅ https://api.revenuecat.com - encrypted
✅ https://stripe.com - encrypted
✅ https://your-api.com - encrypted
❌ http://... - FAIL if any
```

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 3: No Hardcoded Keys

**Steps:**
1. Search codebase for payment keys
2. Verify keys are environment variables

**Expected Results:**
- ✅ No `pk_live_` in code
- ✅ No `sk_live_` in code
- ✅ All keys from environment
- ✅ Test keys only in test mode

**Search Results:**
```
❌ "pk_live_xxxxx" in code - FAIL
✅ process.env.STRIPE_KEY - PASS
```

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Part 5: Multi-User Scenarios

### Test Case 1: Different Users Can Subscribe

**Steps:**
1. Create Account A
2. Subscribe to plan
3. Logout
4. Create Account B
5. Subscribe to plan
6. Verify both have active subscriptions

**Expected Results:**
- ✅ Account A: Active
- ✅ Account B: Active
- ✅ No conflict between accounts
- ✅ Separate entitlements

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 2: Duplicate Subscription (Account Linking)

**Steps:**
1. Account A subscribes
2. Different Apple ID subscribes
3. Try to link both to Account A
4. Observe error handling

**Expected Results:**
- ✅ "Subscription already linked" error
- ✅ Clear message about account linking
- ✅ User can use different Apple ID
- ✅ No fraudulent linking

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Part 6: Transaction Verification

### Test Case 1: Transaction History Visible

**Steps:**
1. Make subscription purchase
2. Go to "Payment History" or "Transactions"
3. See transaction in list

**Expected Results:**
- ✅ Transaction appears
- ✅ Shows date, amount, provider
- ✅ Status: "Paid"
- ✅ Transaction ID visible

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

### Test Case 2: Invoice Generation

**Steps:**
1. Complete payment
2. Check if invoice emailed
3. Verify invoice contents

**Expected Results:**
- ✅ Invoice email received
- ✅ Invoice shows: date, amount, description
- ✅ Company details included
- ✅ Invoice is PDF (if applicable)

**Actual Results:**
- [ ] Passed / [ ] Failed
- Issues: _____________

---

## Part 7: RevenueCat Dashboard Verification

### Steps:
1. Log into RevenueCat dashboard
2. Check your app
3. Verify test purchases appear

**Dashboard Checks:**
- [ ] Test purchase logged
- [ ] Customer appears
- [ ] Entitlement shows "active"
- [ ] Subscription shows correct product
- [ ] Expiry date correct (1 month out)

**Actual Results:**
- [ ] Verified / [ ] Issues found
- Issues: _____________

---

## Summary Checklist

### RevenueCat/IAP (Primary)
- [ ] Purchase flow works
- [ ] Sandbox account created
- [ ] Payment processed (no charge)
- [ ] Subscription status active
- [ ] Restore purchases works
- [ ] Cancel/resubscribe works
- [ ] Receipt validation on backend
- [ ] No payment data logged
- [ ] HTTPS verified

### Stripe (If Enabled)
- [ ] Test card accepted
- [ ] Failed card rejected
- [ ] Billing portal works
- [ ] Error handling good

### Security
- [ ] No card data in logs
- [ ] No hardcoded keys
- [ ] All HTTPS
- [ ] No duplicate linking

### Error Handling
- [ ] Network failures handled
- [ ] Timeouts managed
- [ ] Server errors shown
- [ ] Validation messages clear

### Multi-User
- [ ] Different users can subscribe
- [ ] Account linking prevented
- [ ] No cross-user data leaks

---

## Decision Checklist Before Submission

- [ ] All test cases passed
- [ ] No payment data logged
- [ ] Security verified
- [ ] Error handling complete
- [ ] Dashboard shows transactions
- [ ] Can handle edge cases

**Overall Payment Status:**
- [ ] **READY FOR SUBMISSION** ✅
- [ ] **FIX ISSUES FIRST** ⚠️
- [ ] **NOT READY** ❌

---

## If Issues Found

### Payment Not Processing
- Check RevenueCat API key configured
- Check Stripe keys in environment
- Check TestFlight build includes IAP product
- Check App Store product configured

### Receipt Validation Failing
- Verify backend making RevenueCat API call
- Check RevenueCat sandbox mode
- Review backend logs for errors
- Test with manual `curl` to RevenueCat API

### No Transaction in Dashboard
- Check purchase actually completed
- Verify sandbox account used
- Wait 5+ minutes for sync
- Check RevenueCat app selection

### Duplicate Linking Error
- This is expected behavior (security feature)
- Test with different Apple ID
- Verify error message helpful

---

## Sign-Off

**Payment Testing is Critical for:**
- Revenue integrity
- User trust
- Compliance with Apple
- Fraud prevention
- Subscription lifecycle management

**Required Before App Store Submission:**
All test cases passing + security verified

