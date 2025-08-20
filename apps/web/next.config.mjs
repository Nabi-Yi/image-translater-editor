/** @type {import('next').NextConfig} */
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  // i18n: {
  //   locales: ["default", "ko", "en", "de", "fr"],
  //   defaultLocale: "default",
  //   localeDetection: true,
  // },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    return config;
  },
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
