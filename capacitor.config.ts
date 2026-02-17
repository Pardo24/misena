import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.misena.app",
  appName: "Misena",
  webDir: "out",
  server: {
    // For local dev, point to your Next.js dev server:
    // url: "http://192.168.X.X:3000",
    // cleartext: true,
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
