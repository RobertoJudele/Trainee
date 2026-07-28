// Guards the bug that shipped build 45: EXPO_PUBLIC_* vars live only in the
// gitignored .env, so EAS builds got none of them and RevenueCat was silently
// never configured -> paywall showed "Could not load subscription plans".
// Run: node scripts/check-build-env.js
const assert = require("assert");
const eas = require("../eas.json");

// Every EXPO_PUBLIC_ var the app reads at runtime must be inlined by EAS,
// because .env is gitignored and never reaches the build servers.
const REQUIRED = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID",
  "EXPO_PUBLIC_REVENUECAT_PRODUCT_ID",
];

for (const profile of ["preview", "production"]) {
  const env = eas.build[profile] && eas.build[profile].env;
  assert(env, `eas.json: build.${profile}.env is missing`);
  for (const key of REQUIRED) {
    assert(env[key], `eas.json: build.${profile}.env.${key} is missing or empty`);
  }
}

// Verbose RevenueCat logging must not ship to the App Store.
assert.notStrictEqual(
  eas.build.production.env.EXPO_PUBLIC_REVENUECAT_DEBUG,
  "1",
  "eas.json: production must not set EXPO_PUBLIC_REVENUECAT_DEBUG=1"
);

console.log("build env OK");
