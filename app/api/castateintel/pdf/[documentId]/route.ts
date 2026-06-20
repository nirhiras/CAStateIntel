import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { rows } = await pool.query(
      'SELECT pdf_data, filename FROM castateintel.pal_documents WHERE document_id::text = $1',
      [documentId]
    );
    if (!rows[0] || !rows[0].pdf_data)
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });

    const buffer = Buffer.isBuffer(rows[0].pdf_data)
      ? rows[0].pdf_data
      : Buffer.from(rows[0].pdf_data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${rows[0].filename ?? 'document.pdf'}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[pdf serve] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
