import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static files are served from /academy-assets so that, when this app is
  // proxied under easymedicaldevice.com/academy, they never collide with the
  // WordPress site's own /_next or root paths.
  assetPrefix: process.env.ASSET_PREFIX || '/academy-assets',
  async rewrites() {
    return [
      {
        source: '/academy-assets/_next/:path*',
        destination: '/_next/:path*',
      },
    ];
  },
};

export default nextConfig;
