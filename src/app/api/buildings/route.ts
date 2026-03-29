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

    const response = NextResponse.json(data);
    // Buildings are very static — cache for 5 minutes
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Buildings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
