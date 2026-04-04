import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a household, create one if not
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          const { data: household } = await supabase
            .from('households')
            .insert({ name: '우리 가구' })
            .select()
            .single();

          if (household) {
            await supabase.from('household_members').insert({
              household_id: household.id,
              user_id: user.id,
              role: 'owner',
            });
          }
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
