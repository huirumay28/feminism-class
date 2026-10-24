import { NextRequest, NextResponse } from 'next/server';
import { 
  getReadingNotes, 
  saveReadingNote,
  getReadingChecks,
  saveReadingCheck,
  type ReadingNote,
  type ReadingCheck
} from '@/lib/storage';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');

  if (type === 'checks') {
    const checks = await getReadingChecks();
    return NextResponse.json(checks);
  }

  const notes = await getReadingNotes();
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'saveNote') {
      const note: ReadingNote = body.note;
      await saveReadingNote(note);
      return NextResponse.json({ success: true });
    }

    if (action === 'saveCheck') {
      const check: ReadingCheck = body.check;
      await saveReadingCheck(check);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Notes API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
