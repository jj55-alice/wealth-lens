import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 자주 쓰는 큰 패키지의 tree-shaking 강화 → 초기 번들 축소
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@base-ui/react',
    ],
    // Router Cache 비활성화: 자산 추가/수정 후 대시보드 복귀 시 stale UI 방지
    // 이 앱은 사용자별 실시간 데이터 대시보드라 캐시 필요 없음
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
