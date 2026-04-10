import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: 'placehold.co' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
      {
        source: '/docs/:path*.md',
        destination: '/raw/docs/:path*',
      },
      // Route shadcn registry traffic through the app so installs are observable (Vercel CDN static bypasses middleware).
      {
        source: '/r/:path*',
        destination: '/api/registry-asset/r/:path*',
      },
      {
        source: '/registry/:path*',
        destination: '/api/registry-asset/registry/:path*',
      },
    ];
  },
};

export default withMDX(config);
