import { put, del, list } from '@vercel/blob';

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function uploadFile(
  file: File,
  pathname: string
): Promise<{ url: string }> {
  if (!isBlobConfigured()) {
    throw new Error('Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN.');
  }

  const blob = await put(pathname, file, {
    access: 'public',
  });

  return { url: blob.url };
}

export async function deleteFile(url: string): Promise<void> {
  if (!isBlobConfigured()) {
    return;
  }

  try {
    await del(url);
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
}

export async function listFiles(prefix?: string) {
  if (!isBlobConfigured()) {
    return [];
  }

  const { blobs } = await list({ prefix });
  return blobs;
}
