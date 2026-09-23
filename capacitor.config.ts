import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.personalcost.app",
  appName: "PersonalCost",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
