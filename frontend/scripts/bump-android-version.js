// Increments the Android `versionCode` in android/app/build.gradle.
// Google Play rejects an .aab whose versionCode already exists, so bump
// this before every upload. Pass `--name 1.2.0` to also set the versionName.
const fs = require("fs");
const path = require("path");

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
let gradle = fs.readFileSync(gradlePath, "utf8");

const codeMatch = gradle.match(/versionCode\s+(\d+)/);
if (!codeMatch) {
  console.error("Could not find versionCode in build.gradle");
  process.exit(1);
}
const nextCode = parseInt(codeMatch[1], 10) + 1;
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);

const nameFlag = process.argv.indexOf("--name");
let nameMsg = "";
if (nameFlag !== -1 && process.argv[nameFlag + 1]) {
  const nextName = process.argv[nameFlag + 1];
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${nextName}"`);
  nameMsg = `, versionName -> "${nextName}"`;
}

fs.writeFileSync(gradlePath, gradle);
console.log(`versionCode -> ${nextCode}${nameMsg}`);
