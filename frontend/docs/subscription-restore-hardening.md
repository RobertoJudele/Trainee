# Follow-up: self-healing re-subscribe (restore on "receipt already in use")

**Status:** Not yet implemented (optional hardening).
**File to change:** `frontend/app/checkout.tsx` — the `startCheckout` catch block (the `isAlreadyLinked` branch).
**Related:** backend `TRANSFER` webhook handling in `server/src/controllers/billing.ts` (`handleRevenueCatTransfer`), and the RevenueCat dashboard transfer-behavior setting.

## Why

When a StoreKit/Play receipt is already bound to a different RevenueCat App User ID, `Purchases.purchasePackage()`
throws `receiptAlreadyInUseError` ("There is already another active subscriber using the same receipt").
Today the app just shows an alert telling the user to sign in with the other account.

The RevenueCat-recommended resolution is to call **`Purchases.restorePurchases()`**, which transfers the
receipt to the current App User ID (per the project's transfer behavior) and activates the entitlement.
With dashboard transfer behavior set to **"Transfer to new App User ID"**, this makes re-subscribe
self-healing instead of a dead end.

> Note: this is only safe to auto-transfer because the backend now revokes the *previous* account on the
> `TRANSFER` webhook (see `handleRevenueCatTransfer`), so one payment can't leave two trainers visible.

## Current code (checkout.tsx, ~lines 521–540)

```ts
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
}
```

## Proposed change

Replace the `isAlreadyLinked` branch with an attempt to restore/transfer, then re-check the entitlement:

```ts
} else if (isAlreadyLinked) {
    try {
        const restored = (await Purchases.restorePurchases()) as unknown as RevenueCatCustomerInfo;
        const entitlement = resolveEntitlement(restored);
        if (entitlement) {
            const productId = entitlement.productIdentifier || REVENUECAT_MONTHLY_PRODUCT_ID;
            await syncRevenueCatToBackend({
                productId,
                expiresAt: entitlement.expirationDate || undefined,
                purchaseToken: `rc-restore-${Date.now()}`,
                originalTransactionId: restored.originalAppUserId,
            });
            setSuccess(true);
            setMessage("Subscription restored and activated.");
        } else {
            // Restore did not yield an active entitlement (e.g. the sub really
            // belongs to a different, still-active account).
            Alert.alert(
                "Subscription Already Linked",
                "This App Store subscription is active on another Trainee account. Sign in with that account, or use a different Apple ID."
            );
        }
    } catch {
        Alert.alert(
            "Subscription Already Linked",
            "This App Store subscription is active on another Trainee account. Sign in with that account, or use a different Apple ID."
        );
    }
}
```

`resolveEntitlement`, `syncRevenueCatToBackend`, `REVENUECAT_MONTHLY_PRODUCT_ID`, and the
`RevenueCatCustomerInfo` type are already used elsewhere in `checkout.tsx` (the `restorePurchases`
call already exists around line 648) — reuse them, don't add new ones.

## Prerequisites
- RevenueCat dashboard → transfer behavior = **"Transfer to new App User ID"**.
- Backend `TRANSFER` revocation deployed (so the previous account is downgraded on transfer).

## How to verify
1. Subscribe on account A (sandbox Apple ID).
2. Log out, log in as account B (same sandbox Apple ID), tap Subscribe.
3. Expect: no error alert — the entitlement transfers, B becomes active, and the backend `TRANSFER`
   webhook downgrades A (A drops out of trainer listings).
