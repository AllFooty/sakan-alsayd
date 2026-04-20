import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSaudiPhone } from '@/lib/utils';
import { isRateLimited } from '@/lib/rate-limit';

const PHOTO_PATH_RE = /^(temp|[0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(`maintenance:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      requester_name,
      requester_phone,
      building_slug,
      room_number,
      category,
      title,
      description,
    } = body;

    // Basic validation
    if (!requester_name || !requester_phone || !building_slug || !title || !category) {
      return NextResponse.json(
        { error: 'Required fields: requester_name, requester_phone, building_slug, title, category' },
        { status: 400 }
      );
    }

    if (!isValidSaudiPhone(requester_phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Must be 10 digits starting with 05.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Look up building by slug to get UUID
    const { data: building, error: buildingError } = await supabase
      .from('buildings')
      .select('id')
      .eq('slug', building_slug)
      .single();

    if (buildingError || !building) {
      return NextResponse.json(
        { error: 'Building not found' },
        { status: 404 }
      );
    }

    const insertData: Record<string, unknown> = {
      building_id: building.id,
      requester_name,
      requester_phone,
      room_number: room_number || null,
      category,
      title,
      description: description || null,
      status: 'submitted',
      priority: 'medium',
    };

    // Accept optional photos array (storage paths) — validate each entry
    if (body.photos && Array.isArray(body.photos)) {
      const validPhotos = body.photos.filter(
        (p: unknown): p is string => typeof p === 'string' && PHOTO_PATH_RE.test(p)
      );
      if (validPhotos.length > 0) {
        insertData.photos = validPhotos;
      }
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating maintenance request:', error);
      return NextResponse.json(
        { error: 'Failed to submit request' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Maintenance form error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
