const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withFmtFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfilePath, "utf-8");

      // Skip if already patched
      if (contents.includes("FMT_CONSTEVAL")) {
        return config;
      }

      // This Ruby snippet patches the fmt header file directly after pods are installed,
      // replacing `consteval` with `constexpr` in the FMT_CONSTEVAL definition.
      const fmtFix = `

    # Fix fmt library consteval error with Xcode 26 / newer Clang
    pods_root = installer.sandbox.root.to_s
    require 'fileutils'
    ['base.h'].each do |header|
      fmt_header = File.join(pods_root, 'fmt', 'include', 'fmt', header)
      if File.exist?(fmt_header)
        FileUtils.chmod('+w', fmt_header)
        content = File.read(fmt_header)
        if content.include?('define FMT_CONSTEVAL consteval')
          content.gsub!('define FMT_CONSTEVAL consteval', 'define FMT_CONSTEVAL constexpr')
          File.write(fmt_header, content)
          puts "[FmtFix] Patched #{header}: FMT_CONSTEVAL -> constexpr"
        end
      end
    end`;

      // Insert after react_native_post_install closing paren
      const searchStr = "react_native_post_install(";
      const idx = contents.indexOf(searchStr);
      if (idx === -1) {
        console.warn("[withFmtFix] Could not find react_native_post_install in Podfile");
        return config;
      }

      // Find the closing parenthesis of react_native_post_install(...)
      let depth = 0;
      let i = idx + searchStr.length;
      for (; i < contents.length; i++) {
        if (contents[i] === "(") depth++;
        if (contents[i] === ")") {
          if (depth === 0) break;
          depth--;
        }
      }
      let lineEnd = contents.indexOf("\n", i);
      if (lineEnd === -1) lineEnd = contents.length;

      contents = contents.slice(0, lineEnd) + fmtFix + contents.slice(lineEnd);
      fs.writeFileSync(podfilePath, contents);
      console.log("[withFmtFix] Successfully patched Podfile to fix fmt consteval issue");

      return config;
    },
  ]);
}

module.exports = withFmtFix;
