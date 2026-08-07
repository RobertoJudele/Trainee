// Builds a signed release .aab for Google Play, cross-platform.
// JS bundling (export:embed) and signing with the upload keystore are handled
// by the Gradle `release` build; signing creds come from ~/.gradle/gradle.properties.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const androidDir = path.join(root, "android");
const isWin = process.platform === "win32";
const gradlew = path.join(androidDir, isWin ? "gradlew.bat" : "gradlew");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWin, // .bat and npx both need a shell on Windows
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// A local AAB takes its EXPO_PUBLIC_* values from frontend/.env — gradle's
// export:embed reads it — NOT from eas.json. So the same file that points the
// dev server at dev-api will happily bake dev-api into a signed Play release,
// and nothing in the build output would say so.
function envApiUrl() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => /^\s*EXPO_PUBLIC_API_URL\s*=/.test(l));
  if (!line) return undefined;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

// Single source of truth: whatever the production EAS profile targets.
function prodApiUrl() {
  const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
  return eas?.build?.production?.env?.EXPO_PUBLIC_API_URL;
}

const current = envApiUrl();
const expected = prodApiUrl();

console.log(`\n  frontend/.env API URL : ${current ?? "(unset — config.ts fallback applies)"}`);
console.log(`  production API URL    : ${expected}\n`);

if (current !== expected && process.env.ALLOW_NON_PROD_API !== "1") {
  console.error("Refusing to build: frontend/.env does not point at production.");
  console.error("This would produce a signed, uploadable Play release wired to the wrong backend.");
  console.error("Fix frontend/.env, or set ALLOW_NON_PROD_API=1 if that is genuinely what you want.\n");
  process.exit(1);
}

// The native android/ project is gitignored and only regenerates on demand, so
// app.json changes (permissions, splash, plugins) never reach gradle without
// this. Not --clean: that discards the build cache and forces a full rebuild
// every time. Run `npx expo prebuild --platform android --clean` by hand if the
// native project ever looks out of sync.
console.log("→ Syncing native project from app.json ...\n");
run("npx", ["expo", "prebuild", "--platform", "android"], root);

console.log("\n→ Building release bundle ...\n");
run(gradlew, ["bundleRelease"], androidDir);

const aab = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "bundle",
  "release",
  "app-release.aab"
);
console.log(`\n✅ AAB ready: ${aab}`);
