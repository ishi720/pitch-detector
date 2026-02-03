/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/pitch-detector' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
