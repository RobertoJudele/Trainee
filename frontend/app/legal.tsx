import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme, typography } from "../src/lib/theme";
import { useLanguage } from "../src/lib/i18n/LanguageContext";

type LegalSection = {
  heading: string;
  body: string;
};

type LegalDocument = {
  id: "terms" | "privacy";
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: LegalSection[];
};

const legalDocuments: LegalDocument[] = [
  {
    id: "terms",
    title: "Terms of Use",
    subtitle: "Terms of Use and End-User Licence Agreement for Salvio.",
    effectiveDate: "July 30, 2026",
    sections: [
      {
        heading: "Introduction",
        body:
          `These Terms of Use and End-User Licence Agreement (the "Terms") govern your access to and use of the Salvio mobile application (the "App"), our websites, and all related features and services (together, the "Service").\n\nSalvio is a fitness and sports-coaching marketplace that helps people discover trainers, coaches, and gyms, manage schedules, and connect with one another.\n\nPlease read section 8 (Health, fitness and safety), section 22 (Limitation of liability) and section 27 (Governing law, consumer rights and disputes) carefully. They affect your legal rights.\n\nBy downloading, installing, accessing, or using the Service, you agree to these Terms. If you do not agree, do not use the Service and delete the App.`,
      },
      {
        heading: "1. Who we are",
        body:
          `The Service is operated by Juroc Tech Solutions SRL, a company organised under the laws of Romania.\n\nRegistered office: Str. Luminii nr. 37, Faurei, Vrancea, 627144, Romania\nTrade register number: J39/412/2026\nCUI / VAT identification: 54645022\nEmail: robertojudele@juroc.tech\n\nIn these Terms, "we", "us", "our", and "Salvio" mean Juroc Tech Solutions SRL. "Salvio" is the brand name under which Juroc Tech Solutions SRL operates the Service.\n\nAny questions, complaints, or claims about the Service or the App should be directed to robertojudele@juroc.tech, or by post to the registered office above. This email address is also our point of contact for the purposes of Regulation (EU) 2022/2065 (the Digital Services Act) and Regulation (EU) 2019/1150 (the Platform-to-Business Regulation).`,
      },
      {
        heading: "2. Acceptance, eligibility and age",
        body:
          `You may use the Service only if you can form a legally binding contract with us and only in compliance with these Terms and all applicable law.\n\nYou must be at least 18 years old to create an account or use the Service. The Service is intended for adults and is not directed to children. We do not knowingly permit users under 18 to register. If we learn that an account belongs to someone under 18, we may suspend or delete it.\n\nIf you use the Service on behalf of a business, gym, club, or other organisation, you represent that you have authority to bind that organisation to these Terms, and "you" refers to both you and that organisation.`,
      },
      {
        heading: "3. Relationship to Apple, Google, and other app stores",
        body:
          `This section applies where you obtained the App from a third-party app store or platform. It is required by those platforms and takes precedence over any conflicting provision elsewhere in these Terms.\n\n3.1 These Terms are between you and us only. You and we acknowledge that these Terms are concluded between you and Juroc Tech Solutions SRL only, and not with Apple Inc. ("Apple"), Google LLC ("Google"), or any other app store operator or device manufacturer. We, not Apple or Google, are solely responsible for the App and its content.\n\n3.2 No app store responsibility. Apple and Google have no obligation whatsoever to furnish any maintenance or support services in respect of the App.\n\n3.3 Third-party beneficiary. You and we acknowledge and agree that Apple and Apple's subsidiaries are third-party beneficiaries of these Terms, and that upon your acceptance of these Terms, Apple will have the right (and will be deemed to have accepted the right) to enforce these Terms against you as a third-party beneficiary. The same applies to Google and its affiliates in respect of the App obtained from Google Play.\n\n3.4 App store terms also apply. Your use of the App is additionally subject to the usage rules and terms of service of the app store from which you obtained it. Nothing in these Terms grants you rights that conflict with, are less restrictive than, or are additional to those usage rules.\n\n3.5 Product claims. You and we acknowledge that we, and not Apple or Google, are responsible for addressing any claim by you or any third party relating to the App or your possession and/or use of the App, including but not limited to: (i) product liability claims; (ii) any claim that the App fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection, privacy, or similar legislation. Nothing in these Terms limits our liability to you beyond what is permitted by applicable law — see section 22.4.`,
      },
      {
        heading: "4. Licence to use the App",
        body:
          `Subject to your compliance with these Terms, we grant you a limited, personal, revocable, non-transferable, non-exclusive licence to download, install, and use the App:\n\n• on any Apple-branded products that you own or control, or on any Android device that you own or control, as applicable; and\n• as permitted by the usage rules of the applicable app store, including any provisions for family sharing or volume purchasing.\n\nThe App is licensed to you, not sold. We and our licensors retain all rights not expressly granted.\n\nYou may not, and may not permit anyone else to:\n\n• copy, modify, adapt, translate, or create derivative works of the App;\n• distribute, sell, lease, rent, sublicense, or otherwise make the App available to any third party, or make it available over a network where it could be used by multiple devices at the same time;\n• reverse engineer, decompile, or disassemble the App, or attempt to derive its source code, except to the extent such restriction is prohibited by applicable law (including the mandatory rights under Romanian and EU law relating to interoperability); or\n• remove, obscure, or alter any proprietary notices.\n\nThis licence terminates automatically if you breach these Terms, and ends when these Terms terminate for any reason.`,
      },
      {
        heading: "5. Accounts and security",
        body:
          `Some features require an account. You agree to provide accurate, current, and complete information, keep it up to date, and keep your password and other credentials confidential.\n\nYou are responsible for all activity that occurs under your account, except to the extent it results from our fault or from a security failure within the Service itself.\n\nYou must notify us promptly at robertojudele@juroc.tech, or through the in-app support options, if you believe your account has been compromised or used without your authorisation.\n\nYou may not share your account, sell or transfer it, or create an account using another person's identity or on another person's behalf without authority.`,
      },
      {
        heading: "6. What Salvio is — and what it is not",
        body:
          `6.1 We are a marketplace, not a provider of training. The Service connects clients with trainers, coaches, gyms, and other independent service providers ("Providers"). We provide discovery, listing, scheduling, and related tools. We do not employ Providers, do not supervise or direct their work, and do not provide training, coaching, medical, nutritional, or other professional services ourselves.\n\n6.2 We are not a party to your arrangements. Any booking, coaching engagement, training session, or in-person service is arranged and performed directly between you and the other user. We are not a party to that arrangement unless we expressly state otherwise in writing. Each user is solely responsible for their own conduct, decisions, performance, pricing, and legal and tax compliance.\n\n6.3 We do not verify Providers. Profile content — including names, photographs, descriptions, experience, specialisations, certifications, credentials, rates, and availability — is supplied by users themselves. We do not independently verify it. We make no representation or warranty that any Provider, gym, listing, or user is suitable, qualified, certified, competent, available, insured, licensed, background-checked, or compliant with any local requirement.\n\nYou are responsible for carrying out your own checks before engaging any Provider or relying on any listing. This includes asking to see qualifications, certifications, and insurance directly.\n\n6.4 Payments between users happen outside the Service. Unless we expressly state otherwise, we do not process, hold, escrow, guarantee, or collect payments between clients and Providers for training sessions or other real-world services. Those payments are arranged directly between the users concerned, and we bear no responsibility for them, including for non-payment, overcharging, refunds, or disputes.`,
      },
      {
        heading: "7. Additional terms for trainers, coaches and other Providers",
        body:
          `If you use the Service as a Provider, the following also applies to you.\n\n7.1 Independent status. You act as an independent business or self-employed professional. Nothing in these Terms creates an employment, agency, partnership, franchise, or joint-venture relationship between you and us. You control how, when, where, and with whom you provide your services, and you set your own prices.\n\n7.2 Your representations. You represent and warrant, on an ongoing basis, that:\n\n• you hold all qualifications, certifications, registrations, licences, and permits required by law to provide the services you offer, and that anything you state on your profile about your credentials and experience is truthful and current;\n• you hold, and will maintain, any professional liability, public liability, or other insurance required by law or reasonably appropriate to the services you offer;\n• you comply with all applicable laws relating to your activity, including health and safety, consumer protection, data protection, employment, and the rules of any gym or venue where you operate; and\n• you have the right to use any gym, venue, equipment, images, and materials you reference or upload.\n\n7.3 Taxes and record-keeping. You are solely responsible for determining, declaring, collecting, reporting, and paying all taxes, contributions, and duties arising from your activity, and for issuing any invoices or receipts required by law. We do not withhold or remit taxes on your behalf and we do not provide tax advice.\n\n7.4 Your own terms with clients. You are responsible for agreeing your own cancellation, no-show, refund, and attendance rules with your clients, for communicating them clearly, and for honouring them.\n\n7.5 You are responsible for your clients' safety. You must exercise the skill and care of a competent professional, screen clients appropriately before physical activity, and not offer medical, diagnostic, or therapeutic services unless you are separately licensed to do so.`,
      },
      {
        heading: "8. Health, fitness and safety",
        body:
          `Please read this section carefully. Physical exercise carries real risk of injury or death.\n\n8.1 No medical or professional advice. We do not provide medical, physiotherapeutic, nutritional, psychological, legal, accounting, or other professional advice. Any training, coaching, fitness, or health-related information available through the Service — including anything published by Providers or other users — is for general informational purposes only and is not a substitute for professional advice, diagnosis, or treatment.\n\n8.2 Consult a professional first. You should consult a qualified physician or other appropriate healthcare professional before beginning, changing, or intensifying any exercise, training, or nutrition programme, and particularly if you are pregnant, are recovering from injury or surgery, or have or suspect any cardiovascular, respiratory, musculoskeletal, metabolic, or other medical condition. Never disregard or delay seeking professional medical advice because of something you read or were told through the Service.\n\n8.3 Assumption of risk. You understand and voluntarily accept that physical exercise and training — whether supervised or not — involve inherent risks, including muscle strains, sprains, fractures, heat illness, cardiac events, other serious injury, permanent disability, and death.\n\nYou participate in any training or physical activity arranged through the Service entirely at your own risk and on your own judgement. You are responsible for monitoring your own condition, disclosing relevant health information to your Provider, warming up appropriately, using equipment correctly, and stopping if you feel unwell.\n\n8.4 Emergencies. The Service is not an emergency service and must not be relied on in an emergency. If you believe you are experiencing a medical emergency, stop immediately and call your local emergency number (112 in Romania and across the European Union).\n\n8.5 Meeting other users in person. Sessions arranged through the Service typically take place in person, often with someone you have not met before. Use good judgement: meet in public or staffed venues where possible, tell someone where you are going, verify credentials and identity independently, do not share unnecessary personal or financial information, and stop any interaction that makes you uncomfortable.\n\nWe do not conduct background checks, identity verification, or criminal-record screening on users. We are not responsible for the conduct of any user, whether online or offline. Please report safety concerns to us promptly using the in-app reporting feature or robertojudele@juroc.tech.\n\n8.6 Nothing in this section limits liability that cannot lawfully be limited, including our liability for death or personal injury caused by our own negligence. See section 22.`,
      },
      {
        heading: "9. Bookings, scheduling, attendance and check-in codes",
        body:
          `9.1 Our scheduling tools are provided as a convenience. They do not guarantee that any client, Provider, or gym will attend, honour, complete, or be able to fulfil any appointment. You are responsible for confirming arrangements, arriving on time, and following any cancellation or attendance rules set by the relevant Provider or venue.\n\n9.2 Where the Service uses check-in codes, booking codes, or similar verification workflows, you must not share, publish, guess, brute-force, or otherwise misuse those codes. We may use these workflows to support scheduling integrity, attendance records, and fraud prevention.\n\n9.3 We may change, suspend, or remove scheduling features, and we are not liable for lost bookings, missed sessions, or scheduling data resulting from technical failure, other than as set out in section 22.`,
      },
      {
        heading: "10. Subscriptions, paid features and billing",
        body:
          `10.1 What is paid. Certain features — principally the ability for Providers to publish and maintain a listing and to access related tools — require a paid subscription. Basic use of the Service by clients to browse and discover Providers does not require payment. We may change which features are free or paid, subject to section 26.\n\n10.2 Where you buy. Paid subscriptions are sold and processed through the app store from which you obtained the App — the Apple App Store or Google Play — acting as the merchant or seller of record for that transaction, or through another payment channel that we make available to you at the point of purchase. The payment, billing, and refund terms of that store or channel apply in addition to these Terms.\n\n10.3 Subscription terms shown before purchase. Before you complete any purchase, the App displays the specific terms of the offer, including: the name of the subscription; the length of each subscription period; the price and, where relevant, the price per period; the duration and terms of any free trial or introductory offer; and the price that will apply after any trial ends. Those displayed terms form part of your agreement. Subscription periods currently offered run for 1, 3, 6, or 12 months; the periods and prices available to you are those shown in the App at the time of purchase.\n\n10.4 Automatic renewal — important. Subscriptions offered through the App are auto-renewable. This means:\n\n• Payment is charged to your app store account at confirmation of purchase.\n• Your subscription renews automatically at the end of each period unless you turn off auto-renewal at least 24 hours before the end of the current period.\n• Your account is charged for renewal within 24 hours before the end of the current period, at the then-current price for the renewing period.\n• You can manage your subscription and turn off auto-renewal at any time in your app store account settings — for Apple, in Settings, then your name, then Subscriptions, or at apps.apple.com/account/subscriptions; for Google Play, in the Play Store under Payments and subscriptions, then Subscriptions. Deleting the App does not cancel your subscription.\n• If you cancel, you keep access until the end of the period you have already paid for. Unless required by law, cancellation part-way through a period does not produce a pro-rata refund.\n\n10.5 Free trials. Where a free trial is offered, it is available once per user or account unless stated otherwise, and it converts into a paid subscription at the price shown unless you cancel at least 24 hours before the trial ends. Any unused portion of a free trial is forfeited if you purchase a subscription during the trial.\n\n10.6 Restoring purchases. If you reinstall the App or change device, use the "Restore Purchases" option in the App to re-associate an existing subscription with your account. Subscriptions are tied to your app store account.\n\n10.7 Refunds. Because the app stores act as merchant of record, refund requests for in-app purchases must be made to that store, not to us — for Apple, via reportaproblem.apple.com; for Google, via Google Play support. We cannot issue, guarantee, or compel a refund of a purchase we did not process. This does not affect any statutory right you have.\n\n10.8 Right of withdrawal for consumers. If you are a consumer resident in the European Union or the wider European Economic Area, you generally have a 14-day right to withdraw from a distance contract for digital services, and equivalent rights apply in the United Kingdom and in a number of other European countries. For purchases made through an app store, that right is administered by the store as seller of record, in accordance with its terms. Note that this right may be lost where you have expressly requested immediate performance and acknowledged that you lose the right of withdrawal once the service has been fully performed. This section does not apply to purchases made in the course of a business, including subscriptions bought by Providers acting in a professional capacity, as the statutory right of withdrawal protects consumers only.\n\n10.9 Price changes. We may change subscription prices. Where a price increase would affect a renewal, you will be notified in accordance with the applicable app store's rules, and the increase will not take effect for your existing subscription until you have had the opportunity to cancel. Continuing after the notice period means you accept the new price.\n\n10.10 Taxes. Prices shown may include or exclude applicable VAT or other taxes as indicated at the point of purchase. You are responsible for any taxes that are your responsibility by law.\n\n10.11 Non-payment. If a payment fails, is reversed, charged back, or is not completed, we may suspend or downgrade the paid features associated with your account, including removing a Provider listing from public display, until the amount is settled.`,
      },
      {
        heading: "11. Acceptable use",
        body:
          `You agree not to use the Service to:\n\n• violate any applicable law or regulation;\n• infringe or misappropriate any intellectual property, privacy, publicity, or other right;\n• upload or transmit malicious code, or interfere with, probe, or circumvent security features, authentication, rate limits, or access controls;\n• scrape, crawl, harvest, or bulk-extract data from the Service, or use automated means to access it, except as we expressly permit;\n• impersonate any person or organisation, or misrepresent your identity, role, qualifications, credentials, or affiliation;\n• post or transmit unlawful, abusive, defamatory, harassing, threatening, hateful, discriminatory, sexually explicit, or misleading content;\n• submit false or incentivised reviews, fake profile information, fraudulent bookings, or fraudulent payment activity;\n• solicit users for purposes unrelated to the Service, send unsolicited commercial messages, or run pyramid, referral-fraud, or similar schemes;\n• stalk, harass, endanger, or attempt to obtain the personal data of another user;\n• access non-public areas of the Service, another user's account, or our systems or infrastructure without authorisation;\n• offer or arrange, through the Service, anything unlawful, or any medical or therapeutic service you are not licensed to provide; or\n• use the Service in any way that disrupts, damages, overburdens, or degrades it or other users' experience.\n\nWe may investigate suspected breaches and take proportionate action, including removing content, limiting features, rate-limiting, suspending, or terminating accounts, and reporting to the authorities where we are required or lawfully permitted to do so.`,
      },
      {
        heading: "12. Your content",
        body:
          `12.1 What you submit. You may submit profile text, photographs, availability, specialisations, rates, reviews, messages, reports, and other material ("Your Content").\n\n12.2 You keep ownership. You retain any intellectual property rights you hold in Your Content.\n\n12.3 Licence to us. You grant us a worldwide, non-exclusive, royalty-free, transferable, and sublicensable licence to host, store, cache, reproduce, display, adapt, resize, reformat, and distribute Your Content for the purposes of operating, securing, supporting, and improving the Service, and to promote the Service where you have made that content public. This licence lasts as long as Your Content remains on the Service, and for a limited period afterwards to the extent needed for backups, security, legal compliance, and dispute resolution. It ends for active display purposes when you delete Your Content or your account, subject to section 24.4.\n\n12.4 Your representations. You represent and warrant that you own or have all rights necessary to submit Your Content and to grant the licence above; that Your Content is accurate and not misleading; that you have obtained the consent of any identifiable person appearing in it; and that it does not infringe any third-party right or violate any law.\n\n12.5 Our discretion. We are not obliged to monitor Your Content, but we may review, moderate, restrict, or remove content that breaches these Terms or applicable law, or that we reasonably consider harmful to users or to the Service. See section 15.`,
      },
      {
        heading: "13. Public profiles, reviews and visibility",
        body:
          `13.1 Information you choose to publish may be visible to other users and, in some cases, to the public. This may include your name, profile photograph, approximate location, description, specialisations, rates, availability, reviews, and contact links.\n\n13.2 You are responsible for what you choose to make visible. Do not publish sensitive personal information — including health information, identification numbers, or home address — unless it is genuinely necessary and you are comfortable with it being seen by others. Information you make public may be copied, cached, indexed, or retained by others outside our control.\n\n13.3 Reviews and feedback must be truthful and based on genuine first-hand experience. You must not write reviews about yourself or a business you are connected with, offer or accept anything of value in exchange for a review, or submit reviews designed to manipulate ratings. We may moderate, annotate, remove, or restrict reviews that appear fraudulent, abusive, or otherwise contrary to these Terms.`,
      },
      {
        heading: "14. Search results, ranking and recommendations",
        body:
          `14.1 The Service ranks and recommends Providers in search results, suggestion lists, and similar surfaces. The main parameters determining ranking, and their relative importance, are:\n\n• relevance to the search, including matching of specialisation, discipline, and any filters or preferences you set;\n• geographic proximity between the searching user and the Provider's stated location or associated gyms;\n• profile completeness and quality, including whether key fields, photographs, and availability are filled in;\n• stated availability and whether the Provider's schedule shows bookable time;\n• ratings and reviews received from other users; and\n• whether the Provider holds an active subscription, which is a prerequisite for a listing appearing in public search results at all.\n\n14.2 We do not accept payment for a specific ranking position, and a Provider cannot buy a higher placement in organic results. A subscription determines whether a Provider is listed, not where they rank among listed Providers. If we ever introduce clearly labelled paid placement or advertising, we will identify it as such and update this section.\n\n14.3 We may adjust ranking logic to improve relevance, combat manipulation and fraud, or comply with law. Where we make a material change to the main ranking parameters described above, we will update this section.`,
      },
      {
        heading: "15. Content moderation, reporting and complaints",
        body:
          `15.1 Reporting content. You can report content or conduct you believe is illegal or breaches these Terms using the in-app reporting feature, or by emailing robertojudele@juroc.tech. Please include enough detail to let us locate and assess the item — a description of why you consider it unlawful or in breach, the location of the content (for example a profile or review), and your contact details so we can respond. Notices that are sufficiently precise and adequately substantiated give us actual knowledge of the item concerned.\n\n15.2 How we handle reports. We will process reports in a timely, diligent, non-arbitrary, and objective way, and we will confirm receipt where you have given us contact details. We may remove or disable access to content, restrict its visibility, limit features, suspend, or terminate an account, or decline to act. Decisions may involve automated tools as well as human review; we do not rely solely on automated decision-making to terminate paid accounts.\n\n15.3 Statement of reasons. Where we restrict the visibility of content you provided, suspend or terminate your account, or suspend monetary payments in relation to it, we will inform you of the decision and give you a statement of reasons — including the ground relied on, the facts we relied on, whether automated means were used, and how you can contest the decision — unless we are legally prohibited from doing so or the content is deceptive commercial content distributed at volume.\n\n15.4 Contesting a decision. If you disagree with a moderation, suspension, or termination decision, reply to the notice or write to robertojudele@juroc.tech within 30 days, explaining why you think it was wrong and including any evidence. We will review the decision, reverse it without delay if the complaint shows the decision was unjustified, and tell you the outcome. Where applicable law gives you a right to refer the matter to an out-of-court dispute settlement body or a court, that right is unaffected — see section 27.\n\n15.5 Misuse of reporting. We may suspend the handling of reports or complaints from users who repeatedly submit manifestly unfounded notices or complaints, after issuing a prior warning.`,
      },
      {
        heading: "16. Third-party services and third-party terms",
        body:
          `16.1 The Service links to, depends on, or interoperates with third-party services — including app stores and billing platforms, payment processors, subscription-management providers, cloud hosting and storage, email delivery, push-notification delivery, and map and place-data providers. Those services are governed by their own terms and privacy policies. We are not responsible for third-party services, their content, availability, or their acts or omissions, except to the extent applicable law does not allow us to exclude that responsibility.\n\n16.2 You must comply with any applicable third-party terms when using the App. For example, your use of the App must not put you in breach of your mobile data or wireless service agreement, or of the terms of any gym or venue whose facilities you use.\n\n16.3 Third-party links or references are not endorsements. Where you choose to use a third-party feature, that third party may process your data under its own policies.`,
      },
      {
        heading: "17. Intellectual property and infringement claims",
        body:
          `17.1 Our rights. The Service — including the App, its software, source code, design, user interface, layout, graphics, logos, the "Salvio" name and branding, text, and other materials, excluding Your Content and third-party materials — is owned by us or our licensors and protected by Romanian, EU, and international intellectual property law. Except for the limited licence in section 4, we reserve all rights.\n\n17.2 Feedback. If you send us suggestions or feedback, you grant us a perpetual, irrevocable, royalty-free right to use it without restriction or compensation. We are not obliged to keep feedback confidential.\n\n17.3 Infringement claims. In the event of any third-party claim that the App, or your possession and use of the App, infringes that third party's intellectual property rights, we, and not Apple or Google or any other app store operator, will be solely responsible for the investigation, defence, settlement, and discharge of that claim, to the extent required by these Terms and applicable law.\n\n17.4 Notifying us of infringement. If you believe content on the Service infringes your intellectual property, contact robertojudele@juroc.tech with a description of the work, the location of the allegedly infringing content, your contact details, and a statement of your good-faith belief that the use is unauthorised.`,
      },
      {
        heading: "18. Privacy and data protection",
        body:
          `Our collection and use of personal data is described in our Privacy Policy, which forms part of these Terms and is available in the App and on our website. Juroc Tech Solutions SRL is the data controller for personal data we collect directly through the Service. By using the Service you acknowledge that your use is also subject to the Privacy Policy.\n\nWhere you obtain personal data about another user through the Service — for example, a Provider receiving a client's contact or scheduling details — you must use it only for the purpose for which it was shared, keep it secure, not disclose it further without a lawful basis, and comply with your own obligations under applicable data protection law.`,
      },
      {
        heading: "19. Notifications and communications",
        body:
          `19.1 We may send you service-related messages that are necessary to operate your account, such as verification emails, password resets, security alerts, billing notices, and changes to these Terms. You cannot opt out of these while you hold an account.\n\n19.2 The App may send push notifications, such as session reminders. These require your device permission and you can withdraw that permission at any time in your device settings, or through any in-app toggle we provide, without losing access to the rest of the Service.\n\n19.3 You consent to receiving notices from us electronically, including by email to the address on your account and by in-app message. It is your responsibility to keep your email address current.`,
      },
      {
        heading: "20. Maintenance, support and availability",
        body:
          `20.1 We, and not Apple, Google, or any other app store operator, are solely responsible for providing any maintenance and support for the App, to the extent set out in these Terms or required by applicable law. Apple and Google have no obligation whatsoever to provide maintenance or support for the App.\n\n20.2 Support is available at robertojudele@juroc.tech and through the in-app support and issue-reporting features. We aim to respond within a reasonable time but do not commit to a specific response or resolution time unless we have separately agreed one with you in writing.\n\n20.3 We may update, modify, suspend, limit, or discontinue the Service or any feature, and may require you to install updates. We aim to give reasonable notice of material changes that adversely affect you, except where a change is needed urgently for security, legal, or operational reasons. See section 26.\n\n20.4 We do not warrant uninterrupted or error-free availability. The Service may be unavailable during maintenance, updates, or events outside our control.`,
      },
      {
        heading: "21. Disclaimers",
        body:
          `21.1 To the maximum extent permitted by applicable law, the Service is provided on an "as is" and "as available" basis, with all faults and without warranty of any kind. We disclaim all implied warranties and conditions, including merchantability, satisfactory quality, fitness for a particular purpose, accuracy, and non-infringement, and any warranty that the Service will be uninterrupted, timely, secure, error-free, or free of viruses or other harmful components.\n\n21.2 We make no warranty as to the conduct, identity, qualifications, competence, honesty, insurance, or suitability of any user or Provider, or as to the accuracy, completeness, or reliability of any listing, profile, review, credential, rate, availability, gym data, map data, or other content on the Service. See sections 6 and 8.\n\n21.3 App store warranty. We are solely responsible for any product warranties in relation to the App, whether express or implied by law, to the extent not effectively disclaimed. In the event of any failure of the App to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price of the App (if any) to you. To the maximum extent permitted by applicable law, Apple will have no other warranty obligation whatsoever with respect to the App, and any other claims, losses, liabilities, damages, costs, or expenses attributable to any failure to conform to any warranty are our sole responsibility, not Apple's. An equivalent position applies to Google in respect of the App obtained from Google Play.\n\n21.4 Some jurisdictions do not allow the exclusion of certain warranties or of implied statutory rights. If you are a consumer, you have statutory rights that these Terms do not affect — including, in the EU, rights relating to the conformity of digital content and digital services. Nothing in this section limits those rights.`,
      },
      {
        heading: "22. Limitation of liability",
        body:
          `22.1 What we are not liable for. To the maximum extent permitted by applicable law, we and our affiliates, officers, directors, employees, contractors, and agents will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, business, contracts, anticipated savings, data, goodwill, or opportunity, arising out of or in connection with these Terms or your use of the Service, however caused and on any theory of liability.\n\n22.2 In particular, and subject to section 22.4, we are not liable for: the acts, omissions, conduct, negligence, or misrepresentations of any user or Provider, whether online or in person; any injury, illness, or death arising from physical activity, training, or coaching arranged through the Service; the accuracy of any credential, qualification, rate, listing, or review; any dispute, non-attendance, cancellation, or non-payment between users; or any payment arranged between users outside the Service.\n\n22.3 Cap. Subject to section 22.4, our total aggregate liability for all claims arising out of or relating to these Terms or the Service will not exceed the greater of (a) the total amount you paid us for the Service in the twelve months immediately before the event giving rise to the claim, and (b) EUR 100.\n\n22.4 What is never limited. Nothing in these Terms excludes or limits our liability for:\n\n• death or personal injury caused by our negligence;\n• fraud or fraudulent misrepresentation;\n• gross negligence or wilful misconduct;\n• any liability that cannot lawfully be excluded or limited, including mandatory statutory rights of consumers under Romanian and EU law.\n\n22.5 We do not limit our liability to you beyond what applicable law permits. If any limitation in this section is held unenforceable, it applies to the maximum extent permitted and the remainder of the section stays in force.\n\n22.6 Each provision of this section operates separately. If you are a consumer, this section does not affect your statutory rights, and you may have remedies against us or against the relevant Provider under mandatory law regardless of these limitations.`,
      },
      {
        heading: "23. Indemnity",
        body:
          `To the extent permitted by applicable law, you agree to indemnify and hold harmless Juroc Tech Solutions SRL and its affiliates, officers, directors, employees, contractors, and agents from and against any claims, liabilities, damages, losses, costs, and expenses, including reasonable legal fees, arising out of or related to: your use of the Service; Your Content; your breach of these Terms; your provision of, or receipt of, services arranged through the Service; your violation of any law or third-party right; or, if you are a Provider, your professional activity, credentials, or tax position.\n\nWe will notify you of any claim for which we seek indemnity and give you a reasonable opportunity to participate in the defence. We may take control of the defence at our own cost, and you must not settle any claim in a way that imposes an obligation or admission on us without our prior written consent.\n\nIf you are a consumer, this section applies only to the extent your conduct was unlawful or in deliberate or negligent breach of these Terms, and it does not extend your liability beyond what applicable law allows.`,
      },
      {
        heading: "24. Suspension, termination and account deletion",
        body:
          `24.1 Your right to stop. You may stop using the Service at any time.\n\n24.2 Deleting your account. You can delete your account and associated profile from within the App, in your profile settings. Deleting your account removes your public profile from active display. Deleting the App from your device does not delete your account and does not cancel a paid subscription — see section 10.4.\n\n24.3 Our right to suspend or terminate. We may suspend, restrict, or terminate your access to all or part of the Service if: you breach these Terms or applicable law; you create risk or legal exposure for us, other users, or third parties; your payment fails or is reversed; we are required to do so by law or by an authority; or we cease to provide the Service.\n\n24.4 Notice and reasons. Except where prohibited by law or where immediate action is necessary, we will give you a statement of reasons in line with section 15.3. Where we terminate a Provider's paid account entirely, and the termination is not based on a breach of these Terms, a legal or regulatory obligation, or repeated breaches, we will give at least 30 days' prior notice on a durable medium. Where we suspend or restrict rather than terminate, we will give reasons at or before the point the restriction takes effect.\n\n24.5 Effect of termination. On termination, your licence under section 4 ends and you must stop using the App. We may delete or anonymise your data in accordance with our Privacy Policy, subject to retention we are required or permitted by law to apply — for example for accounting, tax, security, fraud-prevention, and dispute-resolution purposes.\n\n24.6 Survival. Sections 1, 3, 6, 8, 12.3, 12.4, 17, 21, 22, 23, 24.5, 25, 27, and 28 survive termination, together with any other provision that by its nature should survive.`,
      },
      {
        heading: "25. Export control and legal compliance",
        body:
          `You represent and warrant that:\n\n• you are not located in, under the control of, or a national or resident of any country that is subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a "terrorist supporting" country;\n• you are not listed on any U.S. Government list of prohibited or restricted parties, nor on any equivalent EU, United Nations, or Romanian sanctions or restricted-party list; and\n• you will not use or export the App in violation of any applicable export control or sanctions law.\n\nYou must comply with all applicable local, national, and international laws in your use of the Service.`,
      },
      {
        heading: "26. Changes to the Service and to these Terms",
        body:
          `26.1 We may modify the Service and these Terms from time to time — for example to reflect changes in features, law, security requirements, or our business.\n\n26.2 If we make a material change to these Terms, we will notify you by a reasonable means before it takes effect, such as an in-app notice or an email to your account address. For Providers holding a paid subscription, we will give at least 15 days' notice of changes to these Terms on a durable medium, and longer where necessary to allow technical or commercial adaptation, except where the change is required by a legal or regulatory obligation or is needed to address an unforeseen and imminent danger relating to security, fraud, malware, spam, data breaches, or another cybersecurity risk.\n\n26.3 You may reject a change by ceasing to use the Service and, where applicable, cancelling your subscription and deleting your account before the change takes effect. Continuing to use the Service after the change takes effect means you accept the revised Terms.\n\n26.4 Non-material changes, such as corrections of typographical errors or clarifications that do not reduce your rights or increase your obligations, may take effect on posting.\n\n26.5 We will keep the "Last updated" date at the top of these Terms current, and will make prior versions available on request.`,
      },
      {
        heading: "27. Governing law, consumer rights and disputes",
        body:
          `27.1 Governing law. These Terms and any dispute arising out of or relating to them or the Service are governed by the laws of Romania, excluding its conflict-of-law rules and the United Nations Convention on Contracts for the International Sale of Goods.\n\n27.2 Consumers keep local protection. If you are a consumer, this choice of law does not deprive you of the protection of the mandatory consumer-protection rules of the country where you habitually reside, and you may rely on those rules. This applies in particular, but not only, if you reside in the European Union, the wider European Economic Area, the United Kingdom, or Switzerland.\n\n27.3 First, contact us. Before starting formal proceedings, please contact us at robertojudele@juroc.tech so we can try to resolve the matter directly. Most issues can be settled quickly this way. We will acknowledge your complaint and aim to respond substantively within 30 days.\n\n27.4 Courts — consumers. If you are a consumer, you may bring proceedings in the courts of Romania or in the courts of the country where you are resident, and we may bring proceedings only in the courts of the country where you are resident.\n\n27.5 Courts — business users. If you use the Service in the course of a business, including as a Provider, the courts of Bucharest, Romania have exclusive jurisdiction, and the parties will first attempt in good faith to resolve any dispute by negotiation for 30 days.\n\n27.6 Alternative dispute resolution. Consumers in Romania may also contact the National Authority for Consumer Protection (ANPC), anpc.ro, or an authorised alternative dispute resolution (SAL) entity. We are not obliged to participate in ADR proceedings unless required by law, and we will tell you if we agree to do so in a given case. Consumers resident elsewhere in the EU may contact the consumer authority or ADR body in their own country.\n\n27.7 Data protection complaints. Complaints about how we handle personal data may be made to us, and to the Romanian National Supervisory Authority for Personal Data Processing (ANSPDCP), dataprotection.ro, or to the supervisory authority in your country of residence or work.\n\n27.8 No class actions where lawfully excluded. To the extent permitted by applicable law, disputes will be resolved on an individual basis. Nothing in this section limits any right you have under mandatory law to participate in a collective or representative action.`,
      },
      {
        heading: "28. General",
        body:
          `28.1 Entire agreement. These Terms, together with the Privacy Policy and any offer terms displayed at the point of purchase, form the entire agreement between you and us regarding the Service, and supersede any prior agreement or understanding on that subject.\n\n28.2 Severability. If any provision is held invalid, illegal, or unenforceable, it will be modified to the minimum extent necessary to make it enforceable, or severed if that is not possible, and the remaining provisions stay in full force.\n\n28.3 No waiver. Our failure or delay in enforcing any provision is not a waiver of it, and no waiver is effective unless in writing.\n\n28.4 Assignment. You may not assign or transfer these Terms or your account without our prior written consent. We may assign these Terms in whole or in part to an affiliate, or in connection with a merger, acquisition, reorganisation, or sale of assets, provided your rights are not materially reduced.\n\n28.5 No third-party rights. Except as stated in section 3.3 in respect of Apple and Google, these Terms do not create rights for any third party.\n\n28.6 Force majeure. Neither party is liable for any delay or failure to perform caused by circumstances beyond its reasonable control, including natural disasters, fire, flood, war, civil unrest, acts of government or regulators, epidemics or pandemics, labour disputes, power failures, failures of internet or telecommunications infrastructure, or failures of third-party hosting or platform providers. This does not excuse any obligation to pay amounts already due.\n\n28.7 Relationship. Nothing in these Terms creates any employment, agency, partnership, joint venture, or franchise relationship between you and us.\n\n28.8 Headings and language. Headings are for convenience only and do not affect interpretation. These Terms are drafted in English, which is the authoritative version. Where we make a translation available, it is provided for convenience only, and in the event of any conflict the English version prevails, except where mandatory local law provides otherwise.`,
      },
      {
        heading: "29. Contact",
        body:
          `Juroc Tech Solutions SRL (trading as Salvio)\nStr. Luminii nr. 37, Faurei, Vrancea, 627144, Romania\nTrade register: J39/412/2026\nCUI: 54645022\nEmail: robertojudele@juroc.tech\n\nFor questions, complaints, or claims about the Service or the App, including anything in these Terms, please contact us at the email address above or through the support options in the App. We aim to respond within a reasonable time.`,
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "How Salvio collects, uses, shares, and protects personal data.",
    effectiveDate: "July 30, 2026",
    sections: [
      {
        heading: "Introduction",
        body:
          "Salvio is a fitness and sports-coaching marketplace that connects trainers, sports coaches, and other service providers with potential clients. This Privacy Policy explains how we collect, use, disclose, protect, and retain personal data when you use our mobile app, website, and related services (together, the “Service”). Salvio is operated from Romania (European Union) and the Service is offered in Europe. The EU General Data Protection Regulation (GDPR) and Romanian data protection law are the framework governing this Policy. Where you are covered by another privacy law that grants you additional rights, we will honour those rights as far as they apply to us, and section 12 explains how.\n\nBy using the Service, you acknowledge that you have read this Privacy Policy. If you do not agree with it, you should not use the Service.",
      },
      {
        heading: "1. Who we are and how to contact us",
        body:
          "The Service is operated by Juroc Tech Solutions SRL, a company organized under the laws of Romania (registered office: Str. Luminii nr. 37, Faurei, Vrancea, Romania). Juroc Tech Solutions SRL (“Salvio,” “we,” “us,” or “our”) is the data controller for personal data that we collect directly through the Service, unless a third party is independently acting as a controller for its own services.\n\nIf you have privacy questions, requests, or complaints, you can contact us at robertojudele@juroc.tech, or through the support and contact options provided in the Service.",
      },
      {
        heading: "2. Personal data we collect",
        body:
          "We collect personal data that you provide directly to us, such as your first and last name, email address, phone number, password, date of birth, sex, role selection, profile image, training or coaching details, location information, social contact links, issue reports, billing-related details, and any other information you choose to submit in your profile, messages, support requests, or account settings. If you are a trainer or coach, we may also collect professional profile details such as experience, specializations, rates, availability, schedule information, and gym association data.\n\nWe also collect information automatically when you use the Service. This may include device and app information, IP address, approximate (coarse) location derived from your device or network, log files, crash and diagnostic information, authentication events, rate-limiting and security events, and first-party usage analytics that we generate ourselves. When you view public trainer profiles, we may record profile-view events to power our in-house trainer analytics, for fraud prevention, and for service improvement.\n\nWe do not use third-party advertising networks, ad SDKs, or cross-app tracking technologies. We do not track you across other companies’ apps or websites, and we do not use your personal data for cross-context behavioral advertising.\n\nPush notification token. If you turn on session reminders, your device generates a push notification token, which we store on our servers and associate with your account so that we can deliver those reminders. This token is a device identifier. We use it only to send you the reminders you asked for — never for advertising or tracking. You can turn reminders off at any time in the app or revoke the permission in your device settings, and we delete the stored token when you delete your account.\n\nWe may receive information from third parties when you choose to connect them to the Service, such as subscription, billing, or entitlement data from payment providers, app store billing systems, or RevenueCat; profile image or file-upload data from cloud storage providers; email delivery and verification data from messaging providers; and map or place data from external data sources.",
      },
      {
        heading: "3. How we use personal data",
        body:
          "We use personal data to create and manage accounts, authenticate users, provide the marketplace and scheduling features, display trainer and coach profiles, connect users to potential clients, suggest trainers that match your stated preferences, process subscriptions and billing, deliver verification and transactional emails, send session reminders if you have turned them on, support image uploads, detect fraud and abuse, enforce rate limits, investigate support issues, improve the quality and reliability of the Service, and comply with legal obligations.\n\nWe may use aggregate or de-identified data for analytics, product planning, troubleshooting, and service improvement. Where required by law, we will obtain your consent before using personal data for a purpose that is not compatible with the original purpose of collection.",
      },
      {
        heading: "4. Legal bases for processing",
        body:
          "We process personal data only where we have a valid legal basis under the GDPR. Which basis applies depends on what we are doing:\n\n• Creating and running your account, authenticating you, providing the marketplace, profile, and scheduling features, and processing subscriptions — performance of a contract (Art. 6(1)(b)).\n• Sending session reminders by push notification — your consent (Art. 6(1)(a)). You opt in, and you can withdraw at any time.\n• Security, fraud prevention, rate limiting, abuse investigation, service reliability, and the first-party analytics we use to operate and improve the Service — our legitimate interests (Art. 6(1)(f)).\n• Accounting, tax, and responding to lawful requests from public authorities — compliance with a legal obligation (Art. 6(1)(c)).\n\nWhere we rely on legitimate interests, we weigh those interests against your rights and freedoms, and you may object to that processing (see section 10). Where we rely on consent, you can withdraw it at any time, which does not affect the lawfulness of processing carried out before you withdrew it.\n\nData you have to provide. To create an account we need your first and last name, email address, phone number, and a password. Providing these is a contractual requirement — without them we cannot create your account or provide the Service. Everything else, including your date of birth, sex, profile photo, location, and trainer profile details, is optional. If you decline to provide optional data, the related feature is simply unavailable or your profile is less complete.\n\nMatching and recommendations. We use the preferences you set, together with profile data, stated location, and ratings, to rank and suggest trainers to you. This is profiling within the meaning of the GDPR, but it is not automated decision-making that produces legal effects or similarly significant effects on you — it only affects the order in which trainers appear. You can change or clear your preferences at any time in the app, and the main factors we use for ranking are described in our Terms of Use.",
      },
      {
        heading: "5. How we share personal data",
        body:
          "We do not sell your personal data, and we do not share it for cross-context behavioral advertising. We may share personal data with service providers and processors that help us operate the Service, such as hosting providers, database and infrastructure providers, email delivery providers, payment processors (for example, Stripe), app-store billing and subscription providers (for example, Apple App Store, Google Play, and RevenueCat), cloud storage providers, map and location providers (for example, Google Maps), and logging, monitoring, and error-diagnostics providers. These providers are only permitted to process personal data on our instructions and under a data processing agreement.\n\nWe may also share personal data where required by law, to respond to lawful requests, to protect our rights or the rights of others, to prevent fraud or abuse, or in connection with a corporate transaction. Certain information may be visible to other users as part of the marketplace experience, such as trainer profile content you intentionally publish.",
      },
      {
        heading: "6. Third-party services and processor categories",
        body:
          "The Service may rely on third-party services for account email delivery, push or transactional messaging, billing and subscriptions, cloud hosting, storage, and map or place functionality. These services may process personal data outside the country where you live. When we work with processors, we require contractual or comparable protections intended to preserve confidentiality, integrity, and availability of the data.\n\nIf you interact with a third-party feature, that third party may process your data under its own privacy policy and terms.",
      },
      {
        heading: "7. International data transfers",
        body:
          "The Service may be operated from, and personal data may be stored or processed in, countries other than the country in which you live. This includes transfers to the United States, the European Union, the United Kingdom, and other jurisdictions where our service providers or infrastructure are located. Where required by law, we use appropriate transfer safeguards such as the European Commission’s Standard Contractual Clauses, the UK International Data Transfer Addendum, adequacy decisions, vendor contractual commitments, and other lawful transfer mechanisms.",
      },
      {
        heading: "8. Security measures",
        body:
          "We use technical and organizational safeguards designed to protect personal data from unauthorized access, disclosure, alteration, and destruction. These safeguards include transport-layer encryption in transit, access controls, least-privilege permissions, server-side secret management, validation and sanitization of inputs, rate limiting, audit and diagnostic logging, and role-based access restrictions.\n\nWe also protect certain sensitive workflows by hashing values before storage where feasible, and by using secure token-based authentication for account access. Although we work to protect your information, no system is completely secure, and we cannot guarantee absolute security.",
      },
      {
        heading: "9. Retention of personal data",
        body:
          "We retain personal data only for as long as necessary to provide the Service, comply with legal obligations, resolve disputes, enforce agreements, support accounting and tax requirements, and maintain legitimate business records.\n\nWhen you delete your account, we immediately and permanently delete your account record and the data attached to it from our primary database — your profile, matching preferences, reviews you wrote, issue reports you filed, check-in codes, your stored push notification token, and your authentication tokens. Sessions that other users scheduled with you are kept but unlinked from you. This happens at the moment you confirm deletion, not on a delay.\n\nThe periods below are the retention targets we apply to the remaining categories. Some are enforced automatically and some by periodic review, so an individual item may persist somewhat longer than the target before it is cycled out. You can ask us at any time to delete something sooner (see section 10), and we will do so unless we are legally required to keep it.\n\n• Account and profile data (name, email, phone number, date of birth, sex, role, profile details): deleted when you delete your account.\n• Uploaded images (profile picture, trainer gallery and credential photos): removed from active display when you delete your account; stored copies are deleted on request, and otherwise removed during storage maintenance.\n• Support requests and issue reports: up to 24 months after the issue is resolved.\n• Billing, subscription, and invoicing records: for the period required by applicable Romanian accounting and tax law.\n• Security, fraud-prevention, and rate-limiting logs: up to 12 months, unless extended for an active investigation or a legal obligation.\n• Verification and check-in codes (stored only as SHA-256 hashes, never in readable form): until used or expired, then deleted.\n• Backups: retained on a rolling cycle and overwritten in the ordinary course of operations.\n\nWhen personal data is no longer needed, we delete, anonymize, or archive it in line with the above and with applicable law.",
      },
      {
        heading: "10. Your rights",
        body:
          "Depending on where you live, you may have rights to access your personal data, correct inaccurate information, delete your personal data, obtain a copy of your data in a portable format, object to or restrict certain processing, and withdraw consent where processing is based on consent.\n\nTo exercise your rights, contact us at robertojudele@juroc.tech or through the support channels in the Service. We will respond within the timeframe required by applicable law (under the GDPR, generally within one month). We may need to verify your identity before fulfilling a request. We will not discriminate against you for exercising privacy rights.",
      },
      {
        heading: "11. Data portability and deletion",
        body:
          "If you request a copy of your data, we will provide it in a commonly used format where required by law and where technically feasible. If you request deletion, we will delete or anonymize data that we are not legally required or otherwise permitted to retain.\n\nIf you are a trainer, coach, or other professional using the Service, deleting your account may remove your public profile from active display, but some historical records (such as billing, security, and abuse-prevention logs) may remain for a limited time as permitted by law.",
      },
      {
        heading: "12. Privacy laws outside the EEA",
        body:
          "The Service is currently offered in Europe, so the GDPR and Romanian law are the rules that apply to nearly all of our users. If you are nonetheless covered by a privacy law outside the European Economic Area that grants you additional rights — for example the CCPA/CPRA if you are a California resident, or PIPEDA if you are in Canada — you may exercise those rights using the contact details in section 18, and we will honour them as far as they apply to us.\n\nFor the avoidance of doubt: we do not sell personal data, and we do not share it for cross-context behavioural advertising. We may require verification of your identity before acting on a request.",
      },
      {
        heading: "13. Your GDPR rights and supervisory authority",
        body:
          "If you are covered by GDPR, you may have the right to access, rectify, erase, restrict processing, object to processing, and data portability, as well as the right to lodge a complaint with a supervisory authority. Because Salvio is established in Romania, our lead supervisory authority is the Romanian National Supervisory Authority for Personal Data Processing (ANSPDCP), www.dataprotection.ro. If you are in the EEA or the UK, you may also lodge a complaint with the data protection authority in your country of residence or work. Please contact us at robertojudele@juroc.tech before filing a complaint so we can address your concerns directly.\n\nIf you are covered by a privacy law outside the European Economic Area, section 12 explains how to exercise the rights it gives you.",
      },
      {
        heading: "14. Minors and age restrictions",
        body:
          "The Service is intended for adults and is not directed to children. You must be at least 18 years old to create an account or use the Service, as set out in our Terms of Use. We do not knowingly collect personal data from anyone under 18. If we learn that we have collected personal data from a person under 18, we will take appropriate steps to delete it and close the account.",
      },
      {
        heading: "15. Public profiles, reviews, and visibility",
        body:
          "Certain information you choose to publish in your profile may be visible to other users and, in some cases, to the public. This can include your name, profile photo, location, coach or trainer description, specializations, rates, availability, contact links, and review-related content. You should not include sensitive personal information in public profile fields unless it is necessary for the Service and you are comfortable making it visible to others.\n\nInformation you make public may be copied, shared, or retained by others outside our control. We recommend that you review your profile settings carefully.",
      },
      {
        heading: "16. Cookies and similar technologies",
        body:
          "Where the Service uses a web interface, we may use cookies, local storage, or similar technologies to keep you signed in, remember preferences, secure sessions, and measure basic performance and reliability. Where required by law, we will request consent before placing non-essential cookies. You can usually control cookies through your browser or device settings, although some features may not work properly if cookies are disabled.",
      },
      {
        heading: "17. Changes to this policy",
        body:
          "We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or the Service. If we make material changes, we will take reasonable steps to notify you, such as by posting the updated policy in the Service or providing another appropriate notice. Your continued use of the Service after an updated policy becomes effective means you accept the revised policy.",
      },
      {
        heading: "18. Contact us",
        body:
          "If you have questions about this Privacy Policy, your rights, or how we handle your personal data, please contact:\n\nJuroc Tech Solutions SRL\nEmail: robertojudele@juroc.tech\nRegistered office: Str. Luminii nr. 37, Faurei, Vrancea, Romania\n\nYou can also reach us through the support or contact options available in the Service.",
      },
    ],
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument["id"]>("terms");

  const document = useMemo(
    () => legalDocuments.find((item) => item.id === selectedDocument) ?? legalDocuments[0],
    [selectedDocument]
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>{t("settings")}</Text>
            <Text style={styles.title}>{t("legalAndPolicies")}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {t("reviewLegalSubtitle")}
        </Text>
      </View>

      <View style={styles.segmentRow}>
        {legalDocuments.map((item) => {
          const active = item.id === selectedDocument;
          const translatedTitle = item.id === "terms" ? t("termsOfUseTitle") : t("privacyPolicyTitle");
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedDocument(item.id)}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={translatedTitle}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{translatedTitle}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.documentCard}>
        <Text style={styles.documentTitle}>{selectedDocument === "terms" ? t("termsOfUseTitle") : t("privacyPolicyTitle")}</Text>
        <Text style={styles.documentSubtitle}>{document.subtitle}</Text>
        <Text style={styles.effectiveDate}>{t("effectiveDate")} {document.effectiveDate}</Text>
      </View>

      {document.sections.map((section) => (
        <View key={section.heading} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.heading}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <View style={[styles.footerCard, { marginBottom: theme.spacing.xl + insets.bottom }]}>
        <Text style={styles.footerText}>
          The full legal texts are also available at juroc.tech/salvio-terms.html and juroc.tech/privacy-policy.html.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerCard: {
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
  },
  title: {
    ...typography.h2,
    color: theme.colors.text,
  },
  subtitle: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  segmentRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  segmentLabel: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    fontWeight: "700",
  },
  segmentLabelActive: {
    color: "#FFFFFF",
  },
  documentCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: theme.spacing.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  documentTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  documentSubtitle: {
    ...typography.body2,
    color: theme.colors.textSecondary,
  },
  effectiveDate: {
    ...typography.caption,
    color: theme.colors.primary,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    ...typography.body1,
    color: theme.colors.text,
    fontWeight: "700",
  },
  sectionBody: {
    ...typography.body2,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  footerCard: {
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: theme.spacing.lg,
  },
  footerText: {
    ...typography.body2,
    color: "#065F46",
    lineHeight: 22,
  },
});
