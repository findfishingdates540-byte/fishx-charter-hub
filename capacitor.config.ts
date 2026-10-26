import type { CapacitorConfig } from "@capacitor/cli";

// Native shell loads the live hosted app so server features keep working.
const config: CapacitorConfig = {
  appId: "com.bookfishingtrips.app",
  appName: "Fish-X",
  webDir: "dist/client",
  server: {
    url: "https://www.bookfishingtrips.com/welcome",
    cleartext: false,
    // Local page (bundled in webDir) shown instead of Android's raw
    // "Webpage not available" screen when the connection fails.
    errorPath: "cap-offline.html",
  },
};

export default config;
