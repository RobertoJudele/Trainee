import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import Purchases from "react-native-purchases";
import { useSelector } from "react-redux";
import { API_URL } from "../src/constants/config";
import {
	useValidateIapSubscriptionMutation,
	useGetBillingEntitlementQuery,
	useGetBillingTransactionsQuery,
} from "../features/billing/billingApiSlice";
import { selectCurrentUser } from "../features/auth/authSlice";
import { theme, typography } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

const LOOKUP_KEY = "MonthlySubscription-349c6bd";
const REVENUECAT_ENTITLEMENT_ID =
	process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "trainer_subscription";
const REVENUECAT_MONTHLY_PRODUCT_ID =
	process.env.EXPO_PUBLIC_REVENUECAT_PRODUCT_ID || "com.trainee.trainer_monthly";
const STRIPE_CHECKOUT_RUNTIME_ENABLED =
	process.env.EXPO_PUBLIC_ENABLE_STRIPE_CHECKOUT === "1";

type CheckoutResponse = {
	url?: string;
	message?: string;
};

type RevenueCatEntitlement = {
	expirationDate?: string | null;
	productIdentifier?: string;
};

type RevenueCatCustomerInfo = {
	originalAppUserId?: string;
	entitlements?: {
		active?: Record<string, RevenueCatEntitlement>;
		all?: Record<string, RevenueCatEntitlement>;
	};
};

type RevenueCatPackage = {
	identifier?: string;
	packageType?: string;
	product?: {
		identifier?: string;
		title?: string;
		description?: string;
		price?: number;
		priceString?: string;
	};
};

type RevenueCatOfferings = {
	current?: {
		availablePackages?: RevenueCatPackage[];
	};
};

type RevenueCatPurchaseResult = {
	customerInfo?: RevenueCatCustomerInfo;
};

type SuccessDisplayProps = {
	sessionId: string;
	onManageBilling: () => Promise<void>;
	loading: boolean;
};

type MessageProps = {
	message: string;
};

const ProductDisplay = ({
	title,
	subtitle,
	actionLabel,
	onCheckout,
	loading,
	onRestore,
	restoreLoading,
	restoreLabel,
}: {
	title: string;
	subtitle: string;
	actionLabel: string;
	onCheckout: () => Promise<void>;
	loading: boolean;
	onRestore?: () => Promise<void>;
	restoreLoading?: boolean;
	restoreLabel?: string;
}) => (
	<View style={styles.section}>
		<View style={styles.productRow}>
			<Logo />
			<View style={styles.description}>
				<Text style={styles.title}>{title}</Text>
				<Text style={styles.subtitle}>{subtitle}</Text>
			</View>
		</View>

		<Pressable
			style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
			onPress={onCheckout}
			disabled={loading}
			accessible={true}
			accessibilityRole="button"
			accessibilityLabel={actionLabel}
		>
			{loading ? (
				<ActivityIndicator color="#ffffff" />
			) : (
				<Text style={styles.buttonText}>{actionLabel}</Text>
			)}
		</Pressable>

		{onRestore ? (
			<Pressable
				style={({ pressed }) => [
					styles.secondaryButton,
					pressed && styles.buttonPressed,
				]}
				onPress={onRestore}
				disabled={Boolean(restoreLoading)}
				accessible={true}
				accessibilityRole="button"
				accessibilityLabel={restoreLabel || "Restore Purchases"}
			>
				{restoreLoading ? (
					<ActivityIndicator color={theme.colors.primary} />
				) : (
					<Text style={styles.secondaryButtonText}>
						{restoreLabel || "Restore Purchases"}
					</Text>
				)}
			</Pressable>
		) : null}
	</View>
);

const SuccessDisplay = ({
	sessionId,
	onManageBilling,
	loading,
}: SuccessDisplayProps) => {
	return (
		<View style={styles.section}>
			<View style={styles.productRow}>
				<Logo />
				<View style={styles.description}>
					<Text style={styles.title}>Subscription successful!</Text>
					<Text style={styles.sessionText}>Session: {sessionId}</Text>
				</View>
			</View>

			<Pressable
				style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
				onPress={onManageBilling}
				disabled={loading}
				accessible={true}
				accessibilityRole="button"
				accessibilityLabel="Manage Billing Information"
			>
				{loading ? (
					<ActivityIndicator color="#ffffff" />
				) : (
					<Text style={styles.buttonText}>Manage Billing Information</Text>
				)}
			</Pressable>
		</View>
	);
};

const Message = ({ message }: MessageProps) => (
	<View style={styles.section}>
		<Text style={styles.message}>{message}</Text>
	</View>
);

const NativeIapNotice = () => (
	<View style={styles.section}>
		<Text style={styles.title}>RevenueCat Billing</Text>
		<Text style={styles.message}>
			Subscriptions are handled through Apple App Store / Google Play via RevenueCat
			 in this release.
		</Text>
	</View>
);

const WebBillingModeNotice = () => (
	<View style={styles.section}>
		<Text style={styles.title}>Web Checkout Disabled</Text>
		<Text style={styles.message}>
			RevenueCat mobile billing is active right now. Stripe checkout code is preserved
			 for future activation but is not enabled in this build.
		</Text>
	</View>
);

export default function CheckoutScreen() {
	const params = useLocalSearchParams<{
		success?: string;
		canceled?: string;
		session_id?: string;
	}>();
	const user = useSelector(selectCurrentUser);
	const [validateIapSubscription] = useValidateIapSubscriptionMutation();

	const { data: entitlementResponse, isLoading: isLoadingEntitlement, refetch: refetchEntitlement } = useGetBillingEntitlementQuery();
	const entitlement = entitlementResponse?.data;
	const isSubscribed = entitlement?.isActive;

	const { data: transactionsResponse, isLoading: isLoadingTransactions } = useGetBillingTransactionsQuery(undefined, {
		skip: !isSubscribed,
	});
	const transactions = transactionsResponse?.data || [];

	const [message, setMessage] = useState("");
	const [success, setSuccess] = useState(false);
	const [sessionId, setSessionId] = useState("");
	const [loading, setLoading] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);

	const formatDateString = (dateStr?: string | Date) => {
		if (!dateStr) return "N/A";
		const date = new Date(dateStr);
		if (!Number.isFinite(date.getTime())) return "N/A";
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "trial":
				return theme.colors.primary;
			case "active":
				return theme.colors.success;
			case "canceled":
				return theme.colors.warning;
			case "past_due":
				return theme.colors.error;
			default:
				return theme.colors.textSecondary;
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "trial":
				return "Trial Period";
			case "active":
				return "Active (Auto-renewing)";
			case "canceled":
				return "Cancelled";
			case "past_due":
				return "Past Due / Action Required";
			default:
				return String(status).toUpperCase();
		}
	};

	const getProviderLabel = (source: string) => {
		switch (source) {
			case "apple":
				return "Apple App Store";
			case "google":
				return "Google Play Store";
			case "stripe":
				return "Stripe Checkout";
			default:
				return "Mobile Store";
		}
	};

	const handleManageSubscription = async () => {
		const source = entitlement?.source;
		if (source === "apple" || Platform.OS === "ios") {
			await Linking.openURL("https://apps.apple.com/account/subscriptions");
		} else if (source === "google" || Platform.OS === "android") {
			await Linking.openURL("https://play.google.com/store/account/subscriptions");
		} else {
			Alert.alert("Manage Subscription", `Please manage your subscription directly via your app store account.`);
		}
	};

	const showPastDueBanner = entitlement?.status === "past_due";

	const isExpiringSoon = useMemo(() => {
		if (!entitlement?.expiresAt) return false;
		const expDate = new Date(entitlement.expiresAt);
		const diffTime = expDate.getTime() - Date.now();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays >= 0 && diffDays <= 3;
	}, [entitlement?.expiresAt]);
	
	// Dynamic package state for multi-product support
	const [packages, setPackages] = useState<RevenueCatPackage[]>([]);
	const [selectedPackage, setSelectedPackage] = useState<RevenueCatPackage | null>(null);
	const [fetchingOfferings, setFetchingOfferings] = useState(false);
	const [debugErrorMessage, setDebugErrorMessage] = useState("");

	const isNativeApp = Platform.OS === "ios" || Platform.OS === "android";
	const canUseStripeWebCheckout = !isNativeApp && STRIPE_CHECKOUT_RUNTIME_ENABLED;

	const normalizedParams = useMemo(
		() => ({
			success: Array.isArray(params.success) ? params.success[0] : params.success,
			canceled: Array.isArray(params.canceled)
				? params.canceled[0]
				: params.canceled,
			sessionId: Array.isArray(params.session_id)
				? params.session_id[0]
				: params.session_id,
		}),
		[params.canceled, params.session_id, params.success]
	);

	useEffect(() => {
		if (!canUseStripeWebCheckout) {
			setSuccess(false);
			setSessionId("");
			return;
		}

		if (normalizedParams.success) {
			setSuccess(true);
			setSessionId(normalizedParams.sessionId ?? "");
			setMessage("");
			return;
		}

		if (normalizedParams.canceled) {
			setSuccess(false);
			setSessionId("");
			setMessage(
				"Order canceled - continue to shop around and checkout when you are ready."
			);
			return;
		}

		setSuccess(false);
		setSessionId("");
		setMessage("");
	}, [canUseStripeWebCheckout, normalizedParams]);

	// Fetch offerings dynamically on native apps — retries to handle SDK configure() race condition
	useEffect(() => {
		if (!isNativeApp) {
			return;
		}

		let cancelled = false;

		const fetchOfferings = async (attempt = 0) => {
			setFetchingOfferings(true);
			try {
				const offerings = (await Purchases.getOfferings()) as unknown as RevenueCatOfferings;
				const availablePackages = offerings.current?.availablePackages ?? [];

				if (!cancelled) {
					if (availablePackages.length > 0) {
						setPackages(availablePackages);
						const defaultPkg = availablePackages.find(
							(pkg) => pkg.product?.identifier === REVENUECAT_MONTHLY_PRODUCT_ID
						) || availablePackages[0];
						setSelectedPackage(defaultPkg);
						setMessage("");
					} else if (attempt < 4) {
						// SDK may not be fully configured yet — retry after a short delay
						const delay = (attempt + 1) * 800;
						setTimeout(() => {
							if (!cancelled) {
								void fetchOfferings(attempt + 1);
							}
						}, delay);
						return; // don't set fetchingOfferings false yet
					} else {
						setPackages([]);
						setMessage("no_plans");
						setDebugErrorMessage("No active offerings returned from RevenueCat. Please make sure: \n1. Your Apple Paid Apps Agreement is signed.\n2. Your products are in 'Ready to Submit' status in App Store Connect.\n3. The product identifiers match exactly in RC dashboard.");
					}
				}
			} catch (error) {
				console.error("Failed to fetch RevenueCat offerings:", error);
				const errStr = error instanceof Error ? error.message : JSON.stringify(error);
				if (!cancelled) {
					if (attempt < 4) {
						const delay = (attempt + 1) * 800;
						setTimeout(() => {
							if (!cancelled) {
								void fetchOfferings(attempt + 1);
							}
						}, delay);
						return;
					}
					setMessage("no_plans");
					setDebugErrorMessage(`Failed to fetch offerings. Native Error: ${errStr}`);
				}
			} finally {
				if (!cancelled) {
					setFetchingOfferings(false);
				}
			}
		};

		void fetchOfferings();

		return () => {
			cancelled = true;
		};
	}, [isNativeApp]);

	const resolveEntitlement = (
		customerInfo: RevenueCatCustomerInfo
	): RevenueCatEntitlement | undefined => {
		const activeEntitlement =
			customerInfo.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
		if (activeEntitlement) {
			return activeEntitlement;
		}

		const allEntitlement = customerInfo.entitlements?.all?.[REVENUECAT_ENTITLEMENT_ID];
		if (!allEntitlement) {
			return undefined;
		}

		if (!allEntitlement.expirationDate) {
			return allEntitlement;
		}

		const expiration = new Date(allEntitlement.expirationDate);
		if (Number.isFinite(expiration.getTime()) && expiration.getTime() > Date.now()) {
			return allEntitlement;
		}

		return undefined;
	};

	const syncRevenueCatToBackend = async (payload: {
		productId: string;
		expiresAt?: string;
		purchaseToken?: string;
		originalTransactionId?: string;
	}) => {
		const platform = Platform.OS === "ios" ? "ios" : "android";
		await validateIapSubscription({
			platform,
			productId: payload.productId,
			expiresAt: payload.expiresAt,
			purchaseToken: payload.purchaseToken,
			originalTransactionId: payload.originalTransactionId,
		}).unwrap();
	};

	const openExternalUrl = async (url: string) => {
		const canOpen = await Linking.canOpenURL(url);
		if (!canOpen) {
			Alert.alert("Unable to open URL", "Please try again later.");
			return;
		}
		await Linking.openURL(url);
	};

	const startCheckout = async () => {
		if (isNativeApp) {
			if (!user) {
				Alert.alert("Login Required", "Please sign in before starting a subscription.");
				return;
			}

			if (!selectedPackage) {
				Alert.alert("Selection Required", "Please choose a subscription package.");
				return;
			}

			setLoading(true);
			setMessage("");
			setSuccess(false);

			try {
				const purchaseResult = (await Purchases.purchasePackage(
					selectedPackage as any
				)) as unknown as RevenueCatPurchaseResult;

				const customerInfo = purchaseResult.customerInfo || {};
				const entitlement = resolveEntitlement(customerInfo);
				if (!entitlement) {
					throw new Error(
						"Purchase completed but entitlement is not active yet. Try Restore Purchases."
					);
				}

				const selectedProductId =
					selectedPackage.product?.identifier
					|| entitlement.productIdentifier
					|| REVENUECAT_MONTHLY_PRODUCT_ID;

				await syncRevenueCatToBackend({
					productId: selectedProductId,
					expiresAt: entitlement.expirationDate || undefined,
					purchaseToken: `rc-purchase-${Date.now()}`,
					originalTransactionId: customerInfo.originalAppUserId,
				});

				setSuccess(true);
				setMessage("Subscription activated successfully.");
			} catch (error) {
				const typedError = error as { userCancelled?: boolean; code?: string; message?: string };
				const errorCode = String(typedError.code || "").toLowerCase();
				const wasCancelled = Boolean(typedError.userCancelled) || errorCode.includes("cancel");
				const isAlreadyLinked = errorCode.includes("receiptalreadyinuse") || errorCode === "36" || errorCode.includes("already in use");

				if (wasCancelled) {
					setMessage("Purchase cancelled.");
				} else if (isAlreadyLinked) {
					Alert.alert(
						"Subscription Already Linked",
						"This App Store subscription is already active on another Trainee account. Please sign in with that account, or use a different Apple ID to subscribe."
					);
				} else {
					const fallback = "Unable to complete purchase. Please try again.";
					Alert.alert("Purchase Error", typedError.message || fallback);
				}
			} finally {
				setLoading(false);
			}

			return;
		}

		if (!STRIPE_CHECKOUT_RUNTIME_ENABLED) {
			Alert.alert(
				"Unavailable",
				"Web Stripe checkout is currently disabled in this release mode."
			);
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`${API_URL}/create-checkout-session`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ lookup_key: LOOKUP_KEY }),
			});

			const data = (await response.json()) as CheckoutResponse;
			if (!response.ok) {
				throw new Error(data.message ?? "Failed to create checkout session.");
			}

			if (!data.url) {
				throw new Error("No checkout URL returned by server.");
			}

			await openExternalUrl(data.url);
		} catch (error) {
			const fallback = "Unable to start checkout. Please try again.";
			const errorMessage = error instanceof Error ? error.message : fallback;
			Alert.alert("Checkout Error", errorMessage || fallback);
		} finally {
			setLoading(false);
		}
	};

	const openBillingPortal = async () => {
		if (isNativeApp) {
			Alert.alert(
				"Unavailable",
				"Billing portal is disabled in native mode for this release."
			);
			return;
		}

		if (!STRIPE_CHECKOUT_RUNTIME_ENABLED) {
			Alert.alert(
				"Unavailable",
				"Web Stripe billing portal is currently disabled in this release mode."
			);
			return;
		}

		if (!sessionId) {
			Alert.alert("Missing session", "Session id was not found.");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`${API_URL}/create-portal-session`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ session_id: sessionId }),
			});

			const data = (await response.json()) as CheckoutResponse;
			if (!response.ok) {
				throw new Error(data.message ?? "Failed to open billing portal.");
			}

			if (!data.url) {
				throw new Error("No billing portal URL returned by server.");
			}

			await openExternalUrl(data.url);
		} catch (error) {
			const fallback = "Unable to open billing portal. Please try again.";
			const errorMessage = error instanceof Error ? error.message : fallback;
			Alert.alert("Billing Portal Error", errorMessage || fallback);
		} finally {
			setLoading(false);
		}
	};

	const restorePurchases = async () => {
		if (!isNativeApp) {
			Alert.alert("Unavailable", "Restore purchases is available only on native app builds.");
			return;
		}

		if (!user) {
			Alert.alert("Login Required", "Please sign in before restoring purchases.");
			return;
		}

		setIsRestoring(true);
		setMessage("");

		try {
			const customerInfo = (await Purchases.restorePurchases()) as unknown as RevenueCatCustomerInfo;
			const entitlement = resolveEntitlement(customerInfo);

			if (!entitlement) {
				Alert.alert("No Active Subscription", "No active subscription was found to restore.");
				return;
			}

			await syncRevenueCatToBackend({
				productId: entitlement.productIdentifier || REVENUECAT_MONTHLY_PRODUCT_ID,
				expiresAt: entitlement.expirationDate || undefined,
				purchaseToken: `rc-restore-${Date.now()}`,
				originalTransactionId: customerInfo.originalAppUserId,
			});

			setSuccess(true);
			setMessage("Purchases restored successfully.");
		} catch (error) {
			const typedError = error as { code?: string; message?: string };
			const errorCode = String(typedError.code || "").toLowerCase();
			const isAlreadyLinked = errorCode.includes("receiptalreadyinuse") || errorCode === "36" || errorCode.includes("already in use");

			if (isAlreadyLinked) {
				Alert.alert(
					"Subscription Already Linked",
					"This App Store subscription is already active on another Trainee account. Please sign in with that account to use it."
				);
			} else {
				Alert.alert(
					"Restore Error",
					typedError.message || "Unable to restore purchases. Please try again."
				);
			}
		} finally {
			setIsRestoring(false);
		}
	};

	if (isLoadingEntitlement) {
		return (
			<SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator size="large" color={theme.colors.primary} />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			{isSubscribed ? (
				<ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
					{/* Plan details */}
					<View style={[styles.section, { marginBottom: 16, marginTop: 12 }]}>
						<View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
							<View style={[styles.logoContainer, { backgroundColor: getStatusColor(entitlement?.status || "active") }]}>
								<Ionicons name="shield-checkmark" size={22} color="#ffffff" />
							</View>
							<View style={{ marginLeft: 12, flex: 1 }}>
								<Text style={styles.title}>Your Subscription</Text>
								<Text style={styles.subtitle}>Premium Trainer Access</Text>
							</View>
						</View>
						
						{showPastDueBanner && (
							<View style={styles.errorBanner}>
								<Ionicons name="warning" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
								<Text style={styles.errorBannerText}>
									Payment failed. Please update your billing method in your store settings to avoid loss of access.
								</Text>
							</View>
						)}

						{isExpiringSoon && entitlement?.status === "canceled" && (
							<View style={styles.warningBanner}>
								<Ionicons name="alert-circle" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
								<Text style={styles.warningBannerText}>
									Your subscription is canceled and will expire on {formatDateString(entitlement.expiresAt)}.
								</Text>
							</View>
						)}

						{isExpiringSoon && entitlement?.status === "active" && (
							<View style={styles.infoBanner}>
								<Ionicons name="information-circle" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
								<Text style={styles.infoBannerText}>
									Your subscription is set to renew on {formatDateString(entitlement.expiresAt)}.
								</Text>
							</View>
						)}

						<View style={styles.divider} />

						<View style={styles.detailsGrid}>
							<View style={styles.detailsRow}>
								<Text style={styles.detailsLabel}>Status</Text>
								<View style={[styles.badge, { backgroundColor: getStatusColor(entitlement?.status || "active") + "20" }]}>
									<Text style={[styles.badgeText, { color: getStatusColor(entitlement?.status || "active") }]}>
										{getStatusLabel(entitlement?.status || "active")}
									</Text>
								</View>
							</View>

							<View style={styles.detailsRow}>
								<Text style={styles.detailsLabel}>Billing Cycle</Text>
								<Text style={styles.detailsValue}>RON 100.00 / month</Text>
							</View>

							<View style={styles.detailsRow}>
								<Text style={styles.detailsLabel}>
									{entitlement?.status === "canceled" ? "Expiration Date" : "Next Renewal Date"}
								</Text>
								<Text style={styles.detailsValue}>
									{formatDateString(entitlement?.expiresAt)}
								</Text>
							</View>

							<View style={styles.detailsRow}>
								<Text style={styles.detailsLabel}>Billed Via</Text>
								<Text style={styles.detailsValue}>
									{getProviderLabel(entitlement?.source || "none")}
								</Text>
							</View>
						</View>

						<Pressable
							style={({ pressed }) => [styles.button, { marginTop: 16 }, pressed && styles.buttonPressed]}
							onPress={handleManageSubscription}
							accessible={true}
							accessibilityRole="button"
							accessibilityLabel="Manage Subscription"
						>
							<Ionicons name="open-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
							<Text style={styles.buttonText}>Manage Subscription</Text>
						</Pressable>

						<Pressable
							style={({ pressed }) => [
								styles.secondaryButton,
								pressed && styles.buttonPressed,
							]}
							onPress={restorePurchases}
							disabled={isRestoring}
							accessible={true}
							accessibilityRole="button"
							accessibilityLabel="Restore Purchases"
						>
							{isRestoring ? (
								<ActivityIndicator color={theme.colors.primary} />
							) : (
								<Text style={styles.secondaryButtonText}>Restore Purchases</Text>
							)}
						</Pressable>
					</View>

					{/* Transaction history list */}
					<View style={styles.section}>
						<Text style={[styles.title, { marginBottom: 4 }]}>Payment History</Text>
						<Text style={[styles.subtitle, { marginBottom: 16 }]}>Logs of all billing charges and receipts</Text>

						{isLoadingTransactions ? (
							<ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
						) : transactions.length === 0 ? (
							<View style={styles.emptyContainer}>
								<Ionicons name="receipt-outline" size={32} color={theme.colors.textSecondary} style={{ marginBottom: 8 }} />
								<Text style={styles.emptyText}>No transactions recorded yet.</Text>
							</View>
						) : (
							<View style={styles.transactionList}>
								{transactions.map((tx) => (
									<View key={tx.id} style={styles.transactionItem}>
										<View style={styles.transactionLeft}>
											<Ionicons
												name={tx.provider === "apple" ? "logo-apple" : "logo-google-playstore"}
												size={20}
												color={theme.colors.textSecondary}
												style={{ marginRight: 10 }}
											/>
											<View style={{ flex: 1 }}>
												<Text style={styles.transactionDate}>
													{formatDateString(tx.paidAt)}
												</Text>
												<Text style={styles.transactionIdText} numberOfLines={1}>
													ID: {tx.transactionId.substring(0, 16)}...
												</Text>
											</View>
										</View>
										<View style={styles.transactionRight}>
											<Text style={styles.transactionAmount}>
												{Number(tx.amount).toFixed(2)} {tx.currency}
											</Text>
											<View style={[styles.smallBadge, { backgroundColor: tx.status === "paid" ? theme.colors.success + "15" : theme.colors.error + "15" }]}>
												<Text style={[styles.smallBadgeText, { color: tx.status === "paid" ? theme.colors.success : theme.colors.error }]}>
													{tx.status === "paid" ? "Paid" : tx.status}
												</Text>
											</View>
										</View>
									</View>
								))}
							</View>
						)}
					</View>
				</ScrollView>
			) : (
				<>
					{isNativeApp && <NativeIapNotice />}
					
					{isNativeApp && (
						<ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
							{!success && (
								<View style={styles.section}>
									<Text style={styles.title}>Choose Your Plan</Text>
									<Text style={styles.subtitle}>Select a subscription length that fits your needs.</Text>

									{fetchingOfferings ? (
							<ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 32 }} />
						) : message === "no_plans" ? (
							<View style={{ alignItems: "center", marginVertical: 20 }}>
								<Text style={[styles.message, { textAlign: "center", marginBottom: 16 }]}>
									Could not load subscription plans. Check your internet connection and try again.
								</Text>
								<Pressable
									style={({ pressed }) => [styles.secondaryButton, { width: "100%" }, pressed && styles.buttonPressed]}
									accessible={true}
									accessibilityRole="button"
									accessibilityLabel="Try Again"
									onPress={() => {
										setMessage("");
										setFetchingOfferings(true);
										Purchases.getOfferings()
											.then((res: any) => {
												const pkgs = res?.current?.availablePackages ?? [];
												if (pkgs.length > 0) {
													setPackages(pkgs);
													setSelectedPackage(pkgs[0]);
												} else {
													setMessage("no_plans");
												}
											})
											.catch(() => setMessage("no_plans"))
											.finally(() => setFetchingOfferings(false));
									}}
								>
									<Text style={styles.secondaryButtonText}>Try Again</Text>
								</Pressable>
							</View>
						) : (
										<View style={styles.packageList}>
											{packages.map((pkg) => {
												const isSelected = selectedPackage?.identifier === pkg.identifier;
												return (
													<Pressable
														key={pkg.identifier}
														style={[
															styles.packageItem,
															isSelected && styles.packageItemSelected,
														]}
														onPress={() => setSelectedPackage(pkg)}
														accessible={true}
														accessibilityRole="button"
														accessibilityLabel={`Select ${pkg.product?.title || pkg.identifier || "subscription plan"}`}
													>
														<View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
															<View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
																{isSelected && <View style={styles.radioInner} />}
															</View>
															<View style={styles.packageInfo}>
																<Text style={styles.packageTitle}>
																	{pkg.product?.title || pkg.identifier || "Premium Subscription"}
																</Text>
																{pkg.product?.description ? (
																	<Text style={styles.packageSubtitle}>{pkg.product.description}</Text>
																) : null}
															</View>
														</View>
														<Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
															{pkg.product?.priceString || "Free"}
														</Text>
													</Pressable>
												);
											})}
										</View>
									)}

									<Pressable
										style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
										onPress={startCheckout}
										disabled={loading || fetchingOfferings || packages.length === 0}
										accessible={true}
										accessibilityRole="button"
										accessibilityLabel="Subscribe Now"
									>
										{loading ? (
											<ActivityIndicator color="#ffffff" />
										) : (
											<Text style={styles.buttonText}>Subscribe Now</Text>
										)}
									</Pressable>

									<Pressable
										style={({ pressed }) => [
											styles.secondaryButton,
											pressed && styles.buttonPressed,
										]}
										onPress={restorePurchases}
										disabled={isRestoring}
										accessible={true}
										accessibilityRole="button"
										accessibilityLabel="Restore Purchases"
									>
										{isRestoring ? (
											<ActivityIndicator color={theme.colors.primary} />
										) : (
											<Text style={styles.secondaryButtonText}>Restore Purchases</Text>
										)}
									</Pressable>
								</View>
							)}
							{message !== "" && message !== "no_plans" && <Message message={message} />}
							{debugErrorMessage !== "" && (
								<View style={[styles.section, styles.debugErrorContainer]}>
									<Text style={styles.debugErrorTitle}>Debug Diagnostics</Text>
									<Text style={styles.debugErrorText}>{debugErrorMessage}</Text>
								</View>
							)}
						</ScrollView>
					)}

					{!isNativeApp && !STRIPE_CHECKOUT_RUNTIME_ENABLED && <WebBillingModeNotice />}

					{canUseStripeWebCheckout && (
						<>
					{!success && message === "" && (
						<ProductDisplay
							title="MonthlySubscription"
							subtitle="RON 100.00 / month"
							actionLabel="Checkout"
							onCheckout={startCheckout}
							loading={loading}
						/>
					)}
					{success && sessionId !== "" && (
						<SuccessDisplay
							sessionId={sessionId}
							onManageBilling={openBillingPortal}
							loading={loading}
						/>
					)}
					{(!success && message !== "") || (success && sessionId === "") ? (
						<Message
							message={
								message ||
								"Subscription appears successful, but no session id was returned."
							}
						/>
					) : null}
						</>
					)}
				</>
			)}
		</SafeAreaView>
	);
}

const Logo = () => (
	<View style={styles.logoContainer}>
		<Ionicons name="card" size={20} color="#ffffff" />
	</View>
);

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: theme.colors.background,
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	section: {
		backgroundColor: theme.colors.surface,
		borderRadius: theme.roundness,
		padding: 20,
		borderWidth: 1,
		borderColor: theme.colors.border,
		...theme.shadows.medium,
	},
	productRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 18,
	},
	description: {
		marginLeft: 12,
		flex: 1,
	},
	title: {
		...typography.h3,
		color: theme.colors.text,
	},
	subtitle: {
		marginTop: 6,
		...typography.body2,
		color: theme.colors.textSecondary,
	},
	sessionText: {
		marginTop: 6,
		...typography.caption,
		color: theme.colors.textSecondary,
	},
	button: {
		backgroundColor: theme.colors.primary,
		borderRadius: theme.roundness,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
		...theme.shadows.small,
	},
	secondaryButton: {
		marginTop: 12,
		borderRadius: theme.roundness,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.surface,
	},
	buttonPressed: {
		opacity: 0.9,
	},
	buttonText: {
		...typography.body2,
		color: "#ffffff",
		fontWeight: "700",
	},
	secondaryButtonText: {
		...typography.body2,
		color: theme.colors.primary,
		fontWeight: "700",
	},
	message: {
		...typography.body2,
		color: theme.colors.textSecondary,
		lineHeight: 22,
	},
	logoContainer: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: theme.colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	packageList: {
		marginVertical: 16,
	},
	packageItem: {
		backgroundColor: theme.colors.surface,
		borderRadius: theme.roundness,
		padding: 16,
		borderWidth: 2,
		borderColor: theme.colors.border,
		marginBottom: 12,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		...theme.shadows.small,
	},
	packageItemSelected: {
		borderColor: theme.colors.primary,
		backgroundColor: theme.colors.surface,
	},
	packageInfo: {
		flex: 1,
	},
	packageTitle: {
		...typography.body1,
		color: theme.colors.text,
		fontWeight: "600",
	},
	packageSubtitle: {
		...typography.caption,
		color: theme.colors.textSecondary,
		marginTop: 4,
	},
	packagePrice: {
		...typography.body2,
		color: theme.colors.text,
		fontWeight: "700",
		marginLeft: 8,
	},
	packagePriceSelected: {
		color: theme.colors.primary,
	},
	radioOuter: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: theme.colors.border,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	radioOuterSelected: {
		borderColor: theme.colors.primary,
	},
	radioInner: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: theme.colors.primary,
	},
	debugErrorContainer: {
		marginTop: 20,
		backgroundColor: "#fef2f2",
		borderColor: "#f87171",
		borderWidth: 1.5,
	},
	debugErrorTitle: {
		...typography.body1,
		color: "#dc2626",
		fontWeight: "700",
		marginBottom: 6,
	},
	debugErrorText: {
		...typography.body2,
		color: "#7f1d1d",
		lineHeight: 20,
	},
	divider: {
		height: 1,
		backgroundColor: theme.colors.border,
		marginVertical: 16,
	},
	detailsGrid: {
		marginBottom: 8,
	},
	detailsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 10,
	},
	detailsLabel: {
		...typography.body2,
		color: theme.colors.textSecondary,
		fontWeight: "500",
	},
	detailsValue: {
		...typography.body2,
		color: theme.colors.text,
		fontWeight: "600",
	},
	badge: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	badgeText: {
		...typography.caption,
		fontSize: 10,
		fontWeight: "700",
	},
	errorBanner: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#FEF2F2",
		borderColor: "#FCA5A5",
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		marginTop: 8,
	},
	errorBannerText: {
		...typography.body2,
		color: "#991B1B",
		flex: 1,
		lineHeight: 18,
	},
	warningBanner: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#FFFBEB",
		borderColor: "#FCD34D",
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		marginTop: 8,
	},
	warningBannerText: {
		...typography.body2,
		color: "#92400E",
		flex: 1,
		lineHeight: 18,
	},
	infoBanner: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#ECFDF5",
		borderColor: "#A7F3D0",
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		marginTop: 8,
	},
	infoBannerText: {
		...typography.body2,
		color: "#065F46",
		flex: 1,
		lineHeight: 18,
	},
	emptyContainer: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 24,
	},
	emptyText: {
		...typography.body2,
		color: theme.colors.textSecondary,
	},
	transactionList: {
		marginTop: 8,
	},
	transactionItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.border,
	},
	transactionLeft: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	transactionDate: {
		...typography.body2,
		color: theme.colors.text,
		fontWeight: "600",
	},
	transactionIdText: {
		...typography.caption,
		color: theme.colors.textSecondary,
		marginTop: 2,
		fontSize: 10,
	},
	transactionRight: {
		alignItems: "flex-end",
	},
	transactionAmount: {
		...typography.body2,
		color: theme.colors.text,
		fontWeight: "700",
	},
	smallBadge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 8,
		marginTop: 4,
	},
	smallBadgeText: {
		...typography.caption,
		fontSize: 9,
		fontWeight: "700",
	},
});
