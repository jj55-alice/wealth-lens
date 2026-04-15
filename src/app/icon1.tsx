// 192x192 / 512x512 PWA manifest icons.
// Next.js App Router treats distinct `icon.tsx` route segments as separate icons,
// but only one per file. So we use a single 512x512 icon here; manifest references /icon-large.
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function LargeIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 112,
        }}
      >
        <svg width="360" height="360" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6 L7 18 L12 10 L17 18 L21 6"
            stroke="#10b981"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
