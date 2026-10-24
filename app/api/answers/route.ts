import { NextRequest, NextResponse } from 'next/server';
import { getAnswers, saveAnswer, type Answer } from '@/lib/storage';

export async function GET() {
  const answers = await getAnswers();
  return NextResponse.json(answers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'save') {
      const answer: Answer = body.answer;
      await saveAnswer(answer);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Answers API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
