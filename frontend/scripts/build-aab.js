// Builds a signed release .aab for Google Play, cross-platform.
// JS bundling (export:embed) and signing with the upload keystore are handled
// by the Gradle `release` build; signing creds come from ~/.gradle/gradle.properties.
const { spawnSync } = require("child_process");
const path = require("path");

const androidDir = path.join(__dirname, "..", "android");
const isWin = process.platform === "win32";
const gradlew = path.join(androidDir, isWin ? "gradlew.bat" : "gradlew");

const result = spawnSync(gradlew, ["bundleRelease"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: isWin, // .bat needs a shell on Windows
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

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
