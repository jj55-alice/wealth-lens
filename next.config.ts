import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 자주 쓰는 큰 패키지의 tree-shaking 강화 → 초기 번들 축소
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@base-ui/react',
    ],
  },
};

export default nextConfig;
