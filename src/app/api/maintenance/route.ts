import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSaudiPhone } from '@/lib/utils';
import { isRateLimited } from '@/lib/rate-limit';

const PHOTO_PATH_RE = /^(temp|[0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const SUMMARY_MAX = 150;

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
      apartment_number,
      is_apartment_shared,
      category,
      description,
      extra_details,
    } = body;

    // Basic validation
    if (!requester_name || !requester_phone || !building_slug || !description || !category) {
      return NextResponse.json(
        { error: 'Required fields: requester_name, requester_phone, building_slug, description, category' },
        { status: 400 }
      );
    }

    if (typeof description !== 'string' || description.length > SUMMARY_MAX) {
      return NextResponse.json(
        { error: `Summary must be ${SUMMARY_MAX} characters or fewer.` },
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

    const isShared = is_apartment_shared === true;

    // For apartment-shared issues (kitchen, hallway, AC) we don't want a
    // free-text room number on the row — that confuses the maintenance
    // manager. When the requester provides an apartment_number hint we look
    // it up and stamp apartment_id so the admin UI can render context;
    // otherwise it stays null and an admin resolves the apartment manually.
    let resolvedApartmentId: string | null = null;
    if (isShared && typeof apartment_number === 'string' && apartment_number.trim()) {
      const aptNum = apartment_number.trim().slice(0, 50);
      const { data: apt } = await supabase
        .from('apartments')
        .select('id')
        .eq('building_id', building.id)
        .eq('apartment_number', aptNum)
        .maybeSingle<{ id: string }>();
      if (apt) {
        resolvedApartmentId = apt.id;
      }
    }

    const insertData: Record<string, unknown> = {
      building_id: building.id,
      requester_name,
      requester_phone,
      room_number: isShared ? null : room_number || null,
      // Apartment-shared maintenance lands with apartment_id (when resolvable)
      // and no room_id. Migration 028's trigger fills apartment_id from
      // room_id automatically when room_id is set, so for the per-room path
      // we don't need to set apartment_id explicitly.
      apartment_id: isShared ? resolvedApartmentId : null,
      category,
      description,
      extra_details: typeof extra_details === 'string' && extra_details.trim() ? extra_details : null,
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
