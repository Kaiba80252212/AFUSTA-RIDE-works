import { NextRequest, NextResponse } from 'next/server';
import { mutateDatabase } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const category = String(body.category || 'General Inquiry').trim();
    const message = String(body.message || '').trim();

    if (!name || !email.includes('@') || message.length < 8) {
      return NextResponse.json(
        { error: 'Please provide your name, a valid email, and a message (min 8 characters).' },
        { status: 400 }
      );
    }

    const inquiry = await mutateDatabase((db) => {
      const record = {
        id: `inq-${Date.now()}`,
        name,
        email,
        category,
        message,
        createdAt: new Date().toISOString(),
      };
      db.inquiries.unshift(record);
      return record;
    });

    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit inquiry' },
      { status: 400 }
    );
  }
}
