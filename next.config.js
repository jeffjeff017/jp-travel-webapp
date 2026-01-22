/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['tenor.com', 'media.tenor.com'],
    unoptimized: false,
  },
  // For Vercel deployment
  output: 'standalone',
};

module.exports = nextConfig;
