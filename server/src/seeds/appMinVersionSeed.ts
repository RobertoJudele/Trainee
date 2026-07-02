import { AppMinVersion } from "../models/appMinVersion";

const DEFAULT_MESSAGE =
  "A new version of the app is available. Please update to continue.";

export const seedAppMinVersion = async (): Promise<void> => {
  try {
    const rows = [
      {
        platform: "ios",
        minVersion: "1.0.0",
        storeUrl: "https://apps.apple.com/app/id6775085258",
        message: DEFAULT_MESSAGE,
      },
      {
        platform: "android",
        minVersion: "1.0.0",
        storeUrl:
          "https://play.google.com/store/apps/details?id=com.juroctech.frontend",
        message: DEFAULT_MESSAGE,
      },
    ];

    for (const row of rows) {
      // findOrCreate: never overwrite a row an operator has edited via SQL.
      await AppMinVersion.findOrCreate({
        where: { platform: row.platform },
        defaults: row,
      });
    }

    console.log("✅ App min-version rows ensured.");
  } catch (error) {
    console.error("Error seeding app_min_version", error);
  }
};
