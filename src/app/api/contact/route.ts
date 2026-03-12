import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, city, message } = body;

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
