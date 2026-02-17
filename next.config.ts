import type { NextConfig } from "next";

const isMobileExport = process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
  // Enable static export only when building for Capacitor (mobile)
  // Normal web builds keep the default server mode
  ...(isMobileExport ? { output: "export" } : { output: "standalone" }),


    allowedDevOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.1.55:3000",
      "http://192.168.1.55.nip.io:3000",
    ],

};

export default nextConfig;
