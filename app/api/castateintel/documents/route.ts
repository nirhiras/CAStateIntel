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
      return NextResponse.json(Array.isArray(results) ? results : []);
    }
    const docs = await getAllDocuments({
      stage: stage ? parseInt(stage) : undefined,
      projectNumber,
    });
    return NextResponse.json(Array.isArray(docs) ? docs : []);
  } catch (err: any) {
    console.error('[castateintel/documents] GET error:', err?.message || err);
    return NextResponse.json([]);
  }
}
