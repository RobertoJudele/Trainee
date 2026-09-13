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

// The iOS 1.0.4 upload was rejected by App Store Connect: app.json still had
// the placeholder Google URL scheme. It must be the reversed iOS client id, or
// Google Sign-In has no URL to return to.
const googlePlugin = require("../app.json").expo.plugins.find(
  (p) => Array.isArray(p) && p[0] === "@react-native-google-signin/google-signin"
);
if (googlePlugin) {
  const scheme = googlePlugin[1].iosUrlScheme;
  for (const [profile, { env }] of Object.entries(eas.build)) {
    if (!env) continue;
    const iosId = env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
    const reversed =
      "com.googleusercontent.apps." + iosId.replace(/\.apps\.googleusercontent\.com$/, "");
    assert.strictEqual(
      scheme,
      reversed,
      `app.json: google-signin iosUrlScheme must be the reversed build.${profile}.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
    );
  }
}

// Verbose RevenueCat logging must not ship to the App Store.
assert.notStrictEqual(
  eas.build.production.env.EXPO_PUBLIC_REVENUECAT_DEBUG,
  "1",
  "eas.json: production must not set EXPO_PUBLIC_REVENUECAT_DEBUG=1"
);

console.log("build env OK");
