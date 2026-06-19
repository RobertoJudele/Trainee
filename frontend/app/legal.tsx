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
    subtitle: "Rules for using Trainee and the marketplace features.",
    effectiveDate: "June 18, 2026",
    sections: [
      {
        heading: "1. About us",
        body:
          "The Service is operated by Juroc Tech Solutions SRL, a company organized under the laws of Romania (registered office: Str. Luminii nr. 37, Faurei, Vrancea, Romania). Contact: robertojudele@juroc.tech.",
      },
      {
        heading: "2. Definitions",
        body:
          '"Company", "We", "Us", "Our" refers to Juroc Tech Solutions SRL. "Website" refers to juroc.tech and all its pages. "Services" refers to the sports coaching discovery platform and related services operated by the Company, including coach discovery, profile listings and booking features. "Client", "You", "Your" refers to any individual or legal entity using the Website or engaging our Services. "Agreement" refers to any service contract, statement of work or project agreement entered into between the Company and the Client.',
      },
      {
        heading: "3. Use of the website",
        body:
          "You may use the Website for lawful purposes only. You agree not to: use the Website in any way that violates applicable laws or regulations; transmit any unsolicited commercial communications (spam); attempt to gain unauthorised access to any part of the Website or its infrastructure; use automated tools to scrape or extract data from the Website without our consent; upload or transmit any malicious code, viruses or harmful content.\n\nAll content on the Website — including text, graphics, logos, images and code — is the property of Juroc Tech Solutions SRL or its licensors and is protected by Romanian and EU intellectual property law. You may not reproduce, distribute or create derivative works without our prior written consent.",
      },
      {
        heading: "4. Platform services",
        body:
          "Access to and use of the platform’s features — including coach discovery, profile viewing and booking — is governed by these Terms and any additional terms communicated to registered users. In the event of any conflict, specific platform terms shall prevail.\n\nCoach profiles and availability are provided by the coaches themselves. Juroc Tech Solutions SRL endeavours to verify coach credentials but does not guarantee the accuracy of user-submitted information. Users are encouraged to verify coach qualifications independently.\n\nAny booking made through the platform is an agreement between the user and the coach. Juroc Tech Solutions SRL acts as an intermediary and is not a party to individual coaching agreements.",
      },
      {
        heading: "5. Intellectual property",
        body:
          "All content on the Website — including text, graphics, logos, images and code — is the property of Juroc Tech Solutions SRL or its licensors and is protected by Romanian and EU intellectual property law. Coach profiles and user-generated content remain the property of their respective authors; by submitting content you grant Juroc Tech Solutions SRL a non-exclusive licence to display it on the platform.",
      },
      {
        heading: "6. Confidentiality",
        body:
          "Each party agrees to keep confidential all non-public information received from the other party and marked as confidential or which a reasonable person would consider confidential. This obligation survives termination of any Agreement for a period of 3 years.",
      },
      {
        heading: "7. Limitation of liability",
        body:
          "To the maximum extent permitted by law: the Company’s total liability for any claim arising from these Terms or any Agreement shall not exceed the total fees paid by the Client to the Company in the 12 months preceding the claim; the Company shall not be liable for any indirect, incidental, consequential, special or exemplary damages; the Website is provided “as is” without warranties of any kind.",
      },
      {
        heading: "8. Indemnification",
        body:
          "You agree to indemnify and hold the Company harmless from any claim, damage or expense arising from your breach of these Terms or any unlawful use of the Website or Services.",
      },
      {
        heading: "9. Termination",
        body:
          "Either party may terminate a Service Agreement in accordance with the termination provisions in that Agreement. Upon termination, the Client shall pay for all services rendered up to the termination date. The Company will deliver all completed work products and Client-owned assets.",
      },
      {
        heading: "10. Force majeure",
        body:
          "Neither party shall be liable for delays or failures in performance resulting from circumstances beyond their reasonable control, including natural disasters, acts of government, internet outages or pandemics, provided the affected party notifies the other promptly.",
      },
      {
        heading: "11. Governing law and dispute resolution",
        body:
          "These Terms are governed by the laws of Romania. Any disputes arising from these Terms or any Agreement shall be resolved: first, through good-faith negotiation between the parties; if unresolved within 30 days, through mediation; if mediation fails, through the competent courts in București, Romania.",
      },
      {
        heading: "12. Changes to these terms",
        body:
          "We reserve the right to update these Terms at any time. Continued use of the Website after changes constitutes acceptance. For existing service agreements, changes to these Terms do not affect the governing Agreement.",
      },
      {
        heading: "13. Contact",
        body:
          "For any questions regarding these Terms of Service, please contact: robertojudele@juroc.tech or by post at Juroc Tech Solutions SRL, Str. Luminii nr. 37, Vrancea, 627144 Romania.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "How Trainee collects, uses, shares, and protects personal data.",
    effectiveDate: "June 18, 2026",
    sections: [
      {
        heading: "Introduction",
        body:
          "Trainee is a fitness and sports-coaching marketplace that connects trainers, sports coaches, and other service providers with potential clients. This Privacy Policy explains how we collect, use, disclose, protect, and retain personal data when you use our mobile app, website, and related services (together, the “Service”). Trainee is operated from Romania (European Union), and we treat the EU General Data Protection Regulation (GDPR) and Romanian data protection law as the primary framework governing this Policy. We also describe rights that may apply to you under other laws, such as the CCPA/CPRA (for California residents), PIPEDA (for Canada), and similar laws.\n\nBy using the Service, you acknowledge that you have read this Privacy Policy. If you do not agree with it, you should not use the Service.",
      },
      {
        heading: "1. Who we are and how to contact us",
        body:
          "The Service is operated by Juroc Tech Solutions SRL, a company organized under the laws of Romania (registered office: Str. Luminii nr. 37, Faurei, Vrancea, Romania). Juroc Tech Solutions SRL (“Trainee,” “we,” “us,” or “our”) is the data controller for personal data that we collect directly through the Service, unless a third party is independently acting as a controller for its own services.\n\nIf you have privacy questions, requests, or complaints, you can contact us at robertojudele@juroc.tech, or through the support and contact options provided in the Service.",
      },
      {
        heading: "2. Personal data we collect",
        body:
          "We collect personal data that you provide directly to us, such as your name, email address, phone number, password, profile information, role selection, profile image, training or coaching details, location information, social contact links, issue reports, billing-related details, and any other information you choose to submit in your profile, messages, support requests, or account settings. If you are a trainer or coach, we may also collect professional profile details such as experience, specializations, rates, availability, schedule information, and gym association data.\n\nWe also collect information automatically when you use the Service. This may include device and app information, IP address, approximate (coarse) location derived from your device or network, log files, crash and diagnostic information, screen interactions, authentication events, rate-limiting and security events, and first-party usage analytics that we generate ourselves. When you view public trainer profiles, we may record profile-view events to power our in-house trainer analytics, for fraud prevention, and for service improvement.\n\nWe do not use third-party advertising networks, ad SDKs, or cross-app tracking technologies. We do not track you across other companies’ apps or websites, and we do not use your personal data for cross-context behavioral advertising.\n\nWe may receive information from third parties when you choose to connect them to the Service, such as subscription, billing, or entitlement data from payment providers, app store billing systems, or RevenueCat; profile image or file-upload data from cloud storage providers; email delivery and verification data from messaging providers; and map or place data from external data sources.",
      },
      {
        heading: "3. How we use personal data",
        body:
          "We use personal data to create and manage accounts, authenticate users, provide the marketplace and scheduling features, display trainer and coach profiles, connect users to potential clients, process subscriptions and billing, deliver verification and transactional emails, support image uploads, detect fraud and abuse, enforce rate limits, investigate support issues, improve the quality and reliability of the Service, and comply with legal obligations.\n\nWe may use aggregate or de-identified data for analytics, product planning, troubleshooting, and service improvement. Where required by law, we will obtain your consent before using personal data for a purpose that is not compatible with the original purpose of collection.",
      },
      {
        heading: "4. Legal bases for processing",
        body:
          "If you are located in the European Economic Area, the United Kingdom, or a similar jurisdiction, we process personal data only when we have a valid legal basis. These bases may include the performance of a contract when we provide the Service to you, our legitimate interests in operating and securing the Service, compliance with legal obligations, and your consent where consent is required, such as for certain optional communications or device features. Where we rely on legitimate interests, we balance our interests against your rights and freedoms.",
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
          "We retain personal data only for as long as necessary to provide the Service, comply with legal obligations, resolve disputes, enforce agreements, support accounting and tax requirements, and maintain legitimate business records.\n\n• Account and profile data: while your account is active; deleted or anonymized within 90 days of account closure.\n• Profile and workout photos: while your account is active; removed within 90 days of account deletion.\n• Support requests and issue reports: up to 24 months after the issue is resolved.\n• Billing, subscription, and invoicing records: for the period required by applicable Romanian accounting and tax law.\n• Security, fraud-prevention, and rate-limiting logs: up to 12 months, unless extended for active investigations or legal obligations.\n• Verification and check-in codes (stored hashed): until used or expired, then deleted.\n• Backups: retained on a rolling cycle and deleted within 90 days.\n\nWhen personal data is no longer needed, we will delete, anonymize, or archive it in accordance with the schedule above and applicable law.",
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
        heading: "12. California privacy notice",
        body:
          "If you are a California resident, you may have rights under the CCPA/CPRA, including the right to know, the right to delete, the right to correct, the right to limit the use of sensitive personal information where applicable, and the right to opt out of certain data disclosures that may be considered “sharing” for cross-context behavioral advertising. Trainee does not intentionally sell personal information in the ordinary sense, but certain data flows may still be considered a disclosure under California law.",
      },
      {
        heading: "13. GDPR, PIPEDA, and similar laws",
        body:
          "If you are covered by GDPR, you may have the right to access, rectify, erase, restrict processing, object to processing, and data portability, as well as the right to lodge a complaint with a supervisory authority. Because Trainee is established in Romania, our lead supervisory authority is the Romanian National Supervisory Authority for Personal Data Processing (ANSPDCP), www.dataprotection.ro. If you are in the EEA or the UK, you may also lodge a complaint with the data protection authority in your country of residence or work. Please contact us at robertojudele@juroc.tech before filing a complaint so we can address your concerns directly.\n\nIf you are covered by PIPEDA or similar Canadian privacy laws, you may have rights to access and challenge the accuracy or completeness of your information. Where local laws provide additional rights, we will honor them as required.",
      },
      {
        heading: "14. Minors and age restrictions",
        body:
          "The Service is intended for adults and is not directed to children. You must be at least the age required by law in your jurisdiction to consent to data processing and to use the Service. We do not knowingly collect personal data from children without appropriate authorization. If we learn that we have collected personal data from a child in violation of applicable law, we will take appropriate steps to delete it.",
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
          The full legal texts are also available at juroc.tech/privacy-policy.html and juroc.tech/terms.html.
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
