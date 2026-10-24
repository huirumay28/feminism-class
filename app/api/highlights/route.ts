import { NextRequest, NextResponse } from 'next/server';
import { 
  getHighlights, 
  saveHighlight, 
  deleteHighlight, 
  updateHighlightNote,
  type Highlight 
} from '@/lib/storage';

export async function GET() {
  const highlights = await getHighlights();
  return NextResponse.json(highlights);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'save') {
      const highlight: Highlight = body.highlight;
      await saveHighlight(highlight);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      await deleteHighlight(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'updateNote') {
      const { id, note } = body;
      await updateHighlightNote(id, note);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Highlight API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
