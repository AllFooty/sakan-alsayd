import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSaudiPhone } from '@/lib/utils';
import { isRateLimited } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_METADATA_KEYS = ['source', 'utm_campaign', 'utm_source', 'utm_medium', 'referrer'];

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(`contact:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

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

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!isValidSaudiPhone(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Must be 10 digits starting with 05.' },
        { status: 400 }
      );
    }

    if (emergency_contact_phone && !isValidSaudiPhone(emergency_contact_phone)) {
      return NextResponse.json(
        { error: 'Invalid emergency contact phone. Must be 10 digits starting with 05.' },
        { status: 400 }
      );
    }

    // Sanitize metadata — only allow whitelisted keys with string values
    const safeMetadata: Record<string, string> = {};
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      for (const key of ALLOWED_METADATA_KEYS) {
        if (typeof metadata[key] === 'string') {
          safeMetadata[key] = metadata[key].slice(0, 200);
        }
      }
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
        metadata: safeMetadata,
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
