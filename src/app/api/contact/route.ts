import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, email, phone, city, message,
      date_of_birth, occupation, emergency_contact_name,
      emergency_contact_phone, contract_start_date,
      with_transportation, metadata,
    } = body;

    // Basic validation
    if (!name || !email || !phone || !city || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('booking_requests')
      .insert({
        name,
        email,
        phone,
        city_interested: city,
        message,
        status: 'new',
        date_of_birth: date_of_birth || null,
        occupation: occupation || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        contract_start_date: contract_start_date || null,
        with_transportation: with_transportation ?? false,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking request:', error);
      return NextResponse.json(
        { error: 'Failed to submit request' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
