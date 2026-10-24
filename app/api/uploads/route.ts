import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, isBlobConfigured } from '@/lib/blob';

export async function POST(request: NextRequest) {
  if (!isBlobConfigured()) {
    return NextResponse.json({ 
      error: 'File uploads are not configured. Please set BLOB_READ_WRITE_TOKEN.' 
    }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const weekNumber = formData.get('weekNumber') as string;
    const itemId = formData.get('itemId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const pathname = `uploads/week-${weekNumber}/${itemId}/${Date.now()}-${file.name}`;
    const result = await uploadFile(file, pathname);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
