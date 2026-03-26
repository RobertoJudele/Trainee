import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { API_URL } from "../src/constants/config";

const LOOKUP_KEY = "MonthlySubscription-349c6bd";

type CheckoutResponse = {
	url?: string;
	message?: string;
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
	onCheckout,
	loading,
}: {
	onCheckout: () => Promise<void>;
	loading: boolean;
}) => (
	<View style={styles.section}>
		<View style={styles.productRow}>
			<Logo />
			<View style={styles.description}>
				<Text style={styles.title}>MonthlySubscription</Text>
				<Text style={styles.subtitle}>RON 100.00 / month</Text>
			</View>
		</View>

		<Pressable
			style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
			onPress={onCheckout}
			disabled={loading}
		>
			{loading ? (
				<ActivityIndicator color="#ffffff" />
			) : (
				<Text style={styles.buttonText}>Checkout</Text>
			)}
		</Pressable>
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

export default function CheckoutScreen() {
	const params = useLocalSearchParams<{
		success?: string;
		canceled?: string;
		session_id?: string;
	}>();

	const [message, setMessage] = useState("");
	const [success, setSuccess] = useState(false);
	const [sessionId, setSessionId] = useState("");
	const [loading, setLoading] = useState(false);

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
	}, [normalizedParams]);

	const openExternalUrl = async (url: string) => {
		const canOpen = await Linking.canOpenURL(url);
		if (!canOpen) {
			Alert.alert("Unable to open URL", "Please try again later.");
			return;
		}
		await Linking.openURL(url);
	};

	const startCheckout = async () => {
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

	return (
		<SafeAreaView style={styles.container}>
			{!success && message === "" && (
				<ProductDisplay onCheckout={startCheckout} loading={loading} />
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
		</SafeAreaView>
	);
}

const Logo = () => (
	<View style={styles.logoContainer}>
		<Text style={styles.logoText}>S</Text>
	</View>
);

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f4f7fb",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	section: {
		backgroundColor: "#ffffff",
		borderRadius: 14,
		padding: 20,
		borderWidth: 1,
		borderColor: "#e7ebf0",
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.08,
		shadowRadius: 10,
		elevation: 3,
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
		fontSize: 18,
		fontWeight: "700",
		color: "#172036",
	},
	subtitle: {
		marginTop: 6,
		fontSize: 14,
		color: "#5b667f",
	},
	sessionText: {
		marginTop: 6,
		fontSize: 12,
		color: "#6d768c",
	},
	button: {
		backgroundColor: "#0f5bff",
		borderRadius: 10,
		height: 46,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonPressed: {
		opacity: 0.9,
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 15,
		fontWeight: "700",
	},
	message: {
		fontSize: 15,
		color: "#1f2a44",
		lineHeight: 22,
	},
	logoContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#0f5bff",
		alignItems: "center",
		justifyContent: "center",
	},
	logoText: {
		color: "#ffffff",
		fontSize: 18,
		fontWeight: "800",
	},
});
