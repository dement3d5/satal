import {NextResponse} from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'satal-web',
      version: '0.1.0'
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}
