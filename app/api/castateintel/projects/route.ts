import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects, getProjectByNumber, getStats } from '@/lib/castateintel/queries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectNumber = searchParams.get('project');
    const stage = searchParams.get('stage') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getStats();
      return NextResponse.json(stats);
    }
    if (projectNumber) {
      const project = await getProjectByNumber(projectNumber);
      if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(project);
    }
    const projects = await getAllProjects({ stage, status, search });
    return NextResponse.json(projects);
  } catch (err) {
    console.error('[castateintel/projects] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
