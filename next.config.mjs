/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Babel as fallback when SWC binary is unavailable (e.g. Node 24 + Next 14)
  experimental: {
    forceSwcTransforms: false,
  },
};

export default nextConfig;
