import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSaudiPhone } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
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

    // Accept optional photos array (storage paths)
    if (body.photos && Array.isArray(body.photos)) {
      insertData.photos = body.photos;
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
