import { NextResponse } from 'next/server';
import { fetchAllIndices } from '@/lib/market/indices';

let cached: { data: Awaited<ReturnType<typeof fetchAllIndices>>; at: number } | null = null;
const TTL = 5 * 60 * 1000; // 5분

export async function GET() {
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json(cached.data);
  }

  const data = await fetchAllIndices();
  cached = { data, at: Date.now() };
  return NextResponse.json(data);
}
