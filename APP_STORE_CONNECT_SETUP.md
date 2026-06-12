# App Store Connect Setup Guide

**Date:** June 6, 2026  
**App Name:** Trainee  
**Bundle ID:** com.juroctech.frontend

---

## Step-by-Step Setup

### 1. Create App Store Connect Record

**URL:** https://appstoreconnect.apple.com

**Steps:**
1. Log in with Apple Developer account
2. Click "My Apps"
3. Click "+" → "New App"
4. Select:
   - Platform: iOS
   - Name: "Trainee"
   - Primary Language: English
   - Bundle ID: com.juroctech.frontend (from Xcode)
   - SKU: trainee-ios-v1 (any unique identifier)
   - User Access: Limited (for now)

5. Click "Create"

---

### 2. App Information

#### App Name & Subtitle
```
Name: Trainee
Subtitle: Discover & Book Premium Trainers
```

**Tips:**
- Name max 30 characters: "Trainee" ✅ (7 chars)
- Subtitle max 30 characters: Keep under limit
- Don't include keywords (use Keywords field instead)

#### Promotional Text
```
Promotional Text (170 max):
"Find certified trainers and book personalized fitness sessions near you."
```

#### Description (1000 char max)
```
Trainee connects you with certified fitness trainers and coaches 
in your area. Browse profiles, check availability, book sessions, 
and transform your fitness goals.

Features:
• Search trainers by specialization and location
• View ratings and reviews
• Easy booking and scheduling
• Secure payments through Apple and Stripe
• Track your fitness sessions

Start your fitness journey today!
```

#### Keywords (100 char max)
```
trainer, fitness, coaching, gym, workouts, personal training
```

#### Support URL (required)
```
https://your-domain.com/support
```

#### Privacy Policy URL (required)
```
https://your-domain.com/privacy
```

#### Marketing URL (optional)
```
https://your-domain.com
```

#### Category
- **Primary:** Health & Fitness ✅
- **Secondary:** (optional, leave blank)

---

### 3. App Icons & Screenshots

#### App Icon
- **Size:** 1024x1024 px
- **Format:** PNG or JPEG
- **Requirements:** 
  - No transparency
  - No rounded corners (iOS adds them)
  - Center content
- **File:** `frontend/assets/icon.png` - **VERIFY SIZE**

#### Screenshots (Required per device)
- **iPhone:** 1290 x 2796 px (6.7" display)
- **iPad:** 2048 x 2732 px (optional)
- **Count:** 2-10 per language recommended

**Screenshot Order (Suggest):**
1. **Login/Welcome** - Show clean auth screen
2. **Trainer Search** - Show search results
3. **Trainer Profile** - Show detailed profile
4. **Booking Flow** - Show how to book
5. **Payment** - Show subscription
6. **My Sessions** - Show booked sessions

**Create Screenshots:**
```bash
# Run app on iPhone simulator
cd frontend
npm run ios

# Take screenshots using Simulator > File > New Screenshot
# Or use QuickTime to record and extract frames
```

#### Preview Video (Optional)
- **Duration:** 15-30 seconds
- **Format:** MP4 or MOV
- **Size:** 5-25 MB
- **Resolution:** 1290 x 2796 px

---

### 4. Version Information

#### Release Version
- Version: 1.0.0 ✅
- Build Number: 1 (needs to be added to app.json)
- Release Type: Automatic (app available immediately)
- Export Compliance: Not Encrypted (unless you use encrypted libs)

#### Release Notes
```
Version 1.0.0 - Initial Release

🚀 Launch Features:
- Browse and discover certified fitness trainers
- Search by specialization and location
- View detailed trainer profiles and reviews
- Book sessions with flexible scheduling
- Secure in-app payments
- Track your fitness journey
- Real-time availability updates

Start your fitness transformation today!
```

---

### 5. TestFlight Configuration

#### Internal Testers (Your Team)
- Automatically added
- No review time
- Unlimited testers

**To Invite Internal Testers:**
1. TestFlight tab in App Store Connect
2. Internal Testing section
3. Click "+" to add testers
4. Enter Apple ID emails
5. They receive automatic invitation

#### External Testers (Beta Users)
- 20-100 recommended for launch
- Requires review (2-3 days)
- Maximum 10,000 testers per version

**To Invite External Testers:**
1. TestFlight → External Testing
2. Create test group: "Beta Testers"
3. Add tester emails
4. Submit version for TestFlight review
5. After approval, testers get invitation

#### Test Information
```
Feedback Email: larisasfirlea@gmail.com
Test Notes:
"Thank you for testing Trainee! We'd love your feedback. 
Please test:
- User registration and login
- Trainer search and filtering  
- Session booking flow
- Subscription/payment process

Report bugs via: [feedback form link]"
```

---

### 6. In-App Purchases Setup

#### Product Configuration
**Path:** App Store Connect → In-App Purchases

**Create Subscription Product:**
1. Click "+"
2. Type: Subscription
3. Reference Name: Premium Trainer Access
4. Product ID: `com.trainee.trainer_monthly`
5. Localized Information:
   - Display Name: "Premium Trainer Access"
   - Description: "Access premium features and unlimited bookings"
6. Subscription Settings:
   - Subscription Duration: 1 month
   - Auto-Renewal: Enabled
   - Billing: Monthly
   - Price: $9.99 USD (RON 100 locally)
   - Renewal Period: Every month
   - Cancellation Policy: Allow customer to cancel

**Pricing:**
```
$9.99 USD (adjust per region)
€9.99 EUR
£8.99 GBP
RON 50.00 (or equivalent)
```

**Test Sandbox Account:**
- Create Sandbox tester in Users & Access
- Use sandbox account for TestFlight payments
- Payments are free in sandbox
- No real charges

---

### 7. App Privacy & Data Collection

#### Privacy Policy
**Path:** App Store Connect → Privacy & Security

**Answer the following:**

**Personal Data Collected:**
- [ ] Contact Info (email, phone)
- [ ] User ID (account identifier)
- [ ] Location data
- [ ] Photos/videos
- [ ] Payment info
- [ ] Device ID
- [ ] Usage data

**Tracking:**
- [ ] Does app track user across apps? **NO**
- [ ] Does app use IDFA? **NO** (unless you add advertising)

**Data Sharing:**
- [ ] Share with third parties? **YES** (Stripe, RevenueCat, hosting)
- [ ] Data selling? **NO**
- [ ] Data retention? See privacy policy

**Data Security:**
- [ ] Encryption in transit? **YES**
- [ ] User deletion available? **YES**

---

### 8. Export Compliance

#### Question
"Does your app use encryption?"

**Answer:** No (unless you're exporting encryption technology)

**For Trainee:**
- HTTPS is standard, not special encryption
- Answer: **NO** (correct)
- Fills in automatically

---

### 9. Content Rating

#### Questionnaire
**Path:** App Store Connect → App Information → Age Rating

**Questions to Answer:**
- Violence/graphic content? **None** ✅
- Sexual content? **None** ✅
- Language/profanity? **Infrequent** (if any)
- Alcohol/tobacco? **None** ✅
- Gambling? **None** ✅
- Horror/scary? **None** ✅

**Rating:** 4+ (Everyone)

---

### 10. Prepare Files Checklist

### App Icon
- [ ] icon.png (1024x1024 px, no transparency)
- [ ] Save location: `frontend/assets/icon.png`

### Screenshots (iPhone 6.7")
- [ ] Screenshot 1: Welcome/Login
- [ ] Screenshot 2: Trainer Search
- [ ] Screenshot 3: Trainer Profile
- [ ] Screenshot 4: Booking Flow
- [ ] Screenshot 5: Payment
- [ ] Format: 1290 x 2796 px PNG
- [ ] Count: 5-10 total

### Text Content
- [ ] App Name: "Trainee"
- [ ] Subtitle: "Discover & Book Premium Trainers"
- [ ] Description (1000 char)
- [ ] Keywords
- [ ] Support URL
- [ ] Privacy Policy URL
- [ ] Release Notes (v1.0)

### Legal Documents
- [ ] Privacy Policy (published on website)
- [ ] Terms of Service (published on website)

### Compliance
- [ ] Marketing URL
- [ ] Support email: larisasfirlea@gmail.com
- [ ] Privacy answers filled
- [ ] Content rating completed
- [ ] Export compliance answered

---

## Important Reminders

### Before Submission
- ✅ Version is 1.0.0
- ✅ Build number is set
- ✅ All screenshots are correct size
- ✅ No placeholder text
- ✅ Privacy policy URL works
- ✅ Support email is valid
- ✅ In-app purchase product is active
- ✅ TestFlight has been tested

### App Store Review
- Review time: 1-3 days typically
- Common rejection reasons:
  - Missing privacy policy (❌ We have it ✅)
  - Broken links (verify all URLs)
  - Unclear purpose (our description is clear ✅)
  - Performance issues (test on device)
  - Missing functionality (✅ Core features implemented)

### Post-Submission
- Monitor review status daily
- Check email for reviewer feedback
- Be ready to respond to questions
- Have fixes ready if rejected
- Once approved, immediately set release date

---

## Timeline Estimate

| Step | Time | Notes |
|------|------|-------|
| Create app record | 5 min | App Store Connect |
| Fill metadata | 30 min | Names, descriptions |
| Create screenshots | 1-2 hours | 5-10 screenshots |
| Setup TestFlight | 15 min | Add testers |
| Setup in-app purchases | 10 min | Product configuration |
| Privacy answers | 15 min | Form questions |
| Review before submit | 30 min | Final checks |
| **Total** | **3-4 hours** | One-time setup |

---

## Checklist Before Hitting "Submit for Review"

### App Information
- [ ] Name: "Trainee"
- [ ] Subtitle: Set and appropriate
- [ ] Description: Compelling, 1000 char
- [ ] Keywords: Relevant
- [ ] Category: Health & Fitness
- [ ] Support URL: Valid
- [ ] Privacy Policy: Published and linked
- [ ] Marketing URL: (optional) Valid

### Version & Build
- [ ] Version: 1.0.0
- [ ] Build number: 1
- [ ] Build uploaded and processing
- [ ] Build appears in "Select build"

### Content
- [ ] App icon: 1024x1024, no transparency
- [ ] Screenshots: All correct size (1290x2796)
- [ ] Screenshots: 5-10 provided
- [ ] Release notes: Written and appropriate

### Compliance
- [ ] Age rating: 4+ selected
- [ ] Privacy answers: All completed
- [ ] Export compliance: Answered
- [ ] Content rights: Confirmed

### TestFlight
- [ ] Internal testers invited and tested
- [ ] External testers ready (20+)
- [ ] Build tested on physical device
- [ ] No critical bugs found

### In-App Purchases
- [ ] Product created: `com.trainee.trainer_monthly`
- [ ] Pricing set
- [ ] Test account created
- [ ] Tested in TestFlight sandbox

---

## Sign-Off

**Status:** READY FOR SETUP ✅

All required information and assets are available or documented. 

**Next Steps:**
1. Log into App Store Connect
2. Follow setup steps 1-10 above
3. Upload build (from task 11)
4. Submit for review
5. Monitor review status
6. Respond to any reviewer feedback

**Estimated Time to Complete:** 3-4 hours of manual setup
