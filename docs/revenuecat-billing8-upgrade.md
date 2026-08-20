# Actualizare RevenueCat pentru Google Play Billing Library 8

**Termen impus de Google: 1 noiembrie 2026.** După acea dată, actualizările
aplicației sunt respinse dacă folosesc o versiune de Billing Library sub 8.0.0.

Investigat la 2026-08-20. Toate versiunile de mai jos au fost verificate direct
în POM-urile din Maven Central, nu deduse.

---

## Situația

**Ce rulează acum:**

```
react-native-purchases 8.12.0
  └─ purchases-hybrid-common 14.3.0
      └─ purchases-android 8.24.0
          └─ com.android.billingclient:billing 7.1.1   ← sub prag
```

**Ce rezolvă:**

```
react-native-purchases 10.7.2
  └─ purchases-hybrid-common 18.31.0
      └─ purchases-android 10.17.0
          └─ com.android.billingclient:billing 8.3.0   ← conform
```

Billing Library nu poate fi forțată din gradle peste SDK-ul vechi — RevenueCat
8.x nu e compatibil cu API-ul ei. Singura cale e actualizarea pachetului npm.

---

## Cât de mare e schimbarea

**Niciun API de JavaScript nu se schimbă.** Changelog-ul lui 9.0.0 o spune
explicit: *„Other than updating the SDK version, there are no changes required."*
La fel la 10.0.0. Toate schimbările sunt native.

Sunt trei, și la 2026-08-20 niciuna nu ne afecta:

| Schimbare | Introdusă în | Starea noastră |
|---|---|---|
| `minSdk` 21 → 23 | v10 | Avem **24**, implicit din Expo 54 |
| Kotlin minim 1.8.0 | v9 | Expo 54 folosește Kotlin 2.x |
| PBL 8 nu mai interoghează abonamente expirate și produse one-time consumate | v9 | Vindem abonamente, nu consumabile |

### Singurul risc real

Avertismentul RevenueCat vizează **produsele one-time configurate ca
„consumable"**: după v9 nu mai pot fi restaurate, iar utilizatorii își pierd
dreptul.

`NON_RENEWING_PURCHASE` apare în codul nostru, dar **nu e un produs vândut** — e
felul în care RevenueCat raportează grantul promoțional de fondator. Vezi
comentariul din `server/src/tests/promotionalGrant.test.ts`.

**De verificat în panoul RevenueCat și în Play Console înainte de actualizare:**
cele patru planuri (1/3/6/12 luni) trebuie să fie **abonamente**. Dacă vreunul e
produs one-time marcat consumabil, schimbă-l în non-consumabil **întâi**.

---

## Pașii

```bash
cd frontend
npm install react-native-purchases@latest
npx expo prebuild --platform android --clean
npm run typecheck && npm test
```

Codul care folosește RevenueCat e în trei locuri și ar trebui să rămână neatins:

- `app/_layout.tsx` — `configure`, `logIn`, `logOut`
- `app/checkout.tsx` — `getOfferings`, achiziție, restaurare
- `server/src/services/billing/` — validarea IAP, neafectată de versiunea din aplicație

---

## Testare

Typecheck-ul și testele **nu acoperă plățile**. Singura verificare reală:

1. Build de TestFlight (`--profile testflight-dev`) și achiziție în sandbox pe iOS
2. Build intern pe Android și achiziție de test
3. Restaurarea achizițiilor pe ambele
4. Confirmarea că entitlement-ul ajunge pe server (`GET /billing/entitlement`)

Punctul 3 contează cel mai mult: restaurarea e exact zona pe care PBL 8 o
schimbă.

---

## De ce nu s-a făcut atunci

Termenul era la peste doi ani distanță, iar sesiunea în care a fost descoperit se
încheia. Modificarea e mică, dar atinge plățile, iar plățile nu se pot valida
decât cu build-uri reale pe ambele platforme — deci merită făcută cu timp de
verificat, nu la coada unei sesiuni.

**Nu amâna până în octombrie 2026.** Până atunci vor mai apărea versiuni majore,
iar saltul devine mai mare decât cel descris aici.
