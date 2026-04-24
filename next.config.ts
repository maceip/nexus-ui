import type { NextConfig } from "next";

const isPagesBuild = process.env.GITHUB_PAGES === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(isPagesBuild
    ? {
        output: "export",
        distDir: "out",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
};

export default nextConfig;
