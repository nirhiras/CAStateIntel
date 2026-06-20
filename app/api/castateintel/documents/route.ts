import { NextRequest, NextResponse } from 'next/server';
import { getAllDocuments, searchDocuments } from '@/lib/castateintel/queries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const stage = searchParams.get('stage');
    const projectNumber = searchParams.get('project') ?? undefined;

    if (search) {
      const results = await searchDocuments(search);
      return NextResponse.json(results);
    }
    const docs = await getAllDocuments({
      stage: stage ? parseInt(stage) : undefined,
      projectNumber,
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error('[castateintel/documents] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
