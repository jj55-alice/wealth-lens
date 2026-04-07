import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getKbPrice } from '@/lib/prices/kb';
import { getSupabaseUrl, getServiceRoleKey } from '@/lib/env';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const supabaseAdmin = createClient(getSupabaseUrl(), getServiceRoleKey());

  const { data: membership } = await supabaseAdmin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: '가구 없음' }, { status: 404 });
  }

  const { data: kbAssets } = await supabaseAdmin
    .from('assets')
    .select('id, kb_complex_id, name')
    .eq('household_id', membership.household_id)
    .not('kb_complex_id', 'is', null);

  if (!kbAssets || kbAssets.length === 0) {
    return NextResponse.json({ updated: 0, message: 'KB 단지 ID가 등록된 부동산이 없습니다' });
  }

  let updated = 0;
  const results: { name: string; success: boolean; price?: number }[] = [];

  for (const asset of kbAssets) {
    try {
      const priceInfo = await getKbPrice(asset.kb_complex_id!);
      if (priceInfo && priceInfo.dealPrice > 0) {
        const valueInWon = priceInfo.dealPrice * 10000;
        await supabaseAdmin
          .from('assets')
          .update({
            kb_estimated_value: valueInWon,
            kb_estimated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);
        updated++;
        results.push({ name: asset.name, success: true, price: valueInWon });
      } else {
        results.push({ name: asset.name, success: false });
      }
    } catch {
      results.push({ name: asset.name, success: false });
    }
  }

  return NextResponse.json({ updated, total: kbAssets.length, results });
}
