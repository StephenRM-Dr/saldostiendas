import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

const SIZE = 512;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fde047',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: SIZE * 0.55,
            fontWeight: 700,
            color: '#422006',
          }}
        >
          $
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
