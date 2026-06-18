import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme, typography } from "../src/lib/theme";

type LegalSection = {
  heading: string;
  body: string;
};

type LegalDocument = {
  id: "terms" | "privacy";
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

const legalDocuments: LegalDocument[] = [
  {
    id: "terms",
    title: "Terms of Use",
    subtitle: "Rules for using Trainee and the marketplace features.",
    sections: [
      {
        heading: "Eligibility and accounts",
        body:
          "The service is intended for adults who can enter a binding agreement. Keep account details accurate and secure, and notify support quickly if you think your account has been compromised.",
      },
      {
        heading: "Marketplace nature",
        body:
          "Trainee connects clients, trainers, coaches, and gyms. We are not a party to agreements between users unless we say otherwise, and users are responsible for their own bookings, attendance, and compliance with local laws.",
      },
      {
        heading: "Acceptable use",
        body:
          "Do not misuse the service, bypass rate limits, upload malware, scrape data, impersonate others, submit false reviews, or use the app in a way that harms the platform or other users.",
      },
      {
        heading: "Content, payments, and privacy",
        body:
          "You are responsible for the content you publish, the payment methods you use, and the third-party services you connect. Our Privacy Policy explains how we collect and use personal data.",
      },
      {
        heading: "Disclaimers and liability",
        body:
          "The service is provided as-is and without guarantees. We limit liability to the maximum extent permitted by law, and we may suspend or terminate access if these terms are violated.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "How Trainee collects, uses, shares, and protects personal data.",
    sections: [
      {
        heading: "What we collect",
        body:
          "We may collect account details, profile information, billing and subscription data, device and usage data, location signals, issue reports, and profile-view events when you use public trainer pages.",
      },
      {
        heading: "How we use it",
        body:
          "We use data to create and manage accounts, provide the marketplace and scheduling features, process billing, send verification emails, support uploads, enforce rate limits, detect abuse, and improve the service.",
      },
      {
        heading: "Sharing and transfers",
        body:
          "We share data with service providers that help operate the app, such as hosting, email, billing, and storage. Some processing may occur outside your home country with appropriate safeguards.",
      },
      {
        heading: "Security, retention, and rights",
        body:
          "We use technical and organizational safeguards such as encryption, access control, secret management, validation, and rate limiting. You may have rights to access, correct, delete, or port your data depending on where you live.",
      },
      {
        heading: "Minors and contact",
        body:
          "The service is intended for adults and is not directed to children. If you have privacy questions or want to exercise your rights, use the support or contact details shown in the app.",
      },
    ],
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
            <Text style={styles.eyebrow}>Settings</Text>
            <Text style={styles.title}>Legal & Policies</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Review the service terms and privacy policy from one place.
        </Text>
      </View>

      <View style={styles.segmentRow}>
        {legalDocuments.map((item) => {
          const active = item.id === selectedDocument;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedDocument(item.id)}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{item.title}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.documentCard}>
        <Text style={styles.documentTitle}>{document.title}</Text>
        <Text style={styles.documentSubtitle}>{document.subtitle}</Text>
        <Text style={styles.effectiveDate}>Effective date: April 18, 2026</Text>
      </View>

      {document.sections.map((section) => (
        <View key={section.heading} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.heading}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <View style={[styles.footerCard, { marginBottom: theme.spacing.xl + insets.bottom }]}> 
        <Text style={styles.footerText}>
          If you need the full legal text, use the repository markdown files: TERMS_OF_USE.md and PRIVACY_POLICY.md.
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
