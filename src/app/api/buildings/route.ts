import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET() {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { data, error } = await supabase
      .from('buildings')
      .select('id, slug, neighborhood_en, neighborhood_ar, city_en, city_ar')
      .eq('is_active', true)
      .order('city_en');

    if (error) {
      console.error('Error fetching buildings:', error);
      return NextResponse.json({ error: 'Failed to fetch buildings' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Buildings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
