import type { CapacitorConfig } from "@capacitor/cli";

// Native shell loads the live hosted app so server features keep working.
const config: CapacitorConfig = {
  appId: "com.bookfishingtrips.app",
  appName: "Fish-X",
  webDir: "dist/client",
  server: {
    url: "https://www.bookfishingtrips.com/welcome",
    cleartext: false,
  },
};

export default config;
