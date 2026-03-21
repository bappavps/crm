
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'xlsx'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Increase chunk load timeout for stable loading in cloud environments
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Directly set the timeout on the existing output object to avoid shallow copy side effects
      if (config.output) {
        config.output.chunkLoadTimeout = 600000; // 600 seconds
      }
    }
    return config;
  },
};

export default nextConfig;
