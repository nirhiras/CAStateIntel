import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const maxDuration = 30;

const STAGE_ABBREV: Record<number, string> = {
  1:'S1BA', 2:'S2AA', 3:'S3SA', 4:'S4PRA',
};
const STAGE_LABELS: Record<number, string> = {
  1:'Stage 1 Business Analysis',
  2:'Stage 2 Alternative Analysis',
  3:'Stage 3 Solutions Analysis',
  4:'Stage 4 Project Readiness and Approval',
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const tmpFile = path.join(os.tmpdir(), `pal_preview_${Date.now()}.pdf`);
    fs.writeFileSync(tmpFile, buffer);

    let result: any = {};
    try {
      const pyScript = [
        'import sys,re,json',
        'import pdfplumber',
        'with pdfplumber.open(sys.argv[1]) as pdf:',
        '    text="\\n".join(p.extract_text() or "" for p in pdf.pages[:4])',
        '    full="\\n".join(p.extract_text() or "" for p in pdf.pages)',
        // Project number — try multiple label patterns
        'pm=re.search(r"(?:Department of Technology |CDT )?Project Number[^:]*:\\s*(\\d{4}-\\d{3,4})",text,re.I)',
        'proj=pm.group(1) if pm and pm.group(1)!="0000-000" else None',
        'if not proj:',
        '    all_p=[m for m in re.findall(r"\\b(\\d{4}-\\d{3,4})\\b",full) if m!="0000-000"]',
        '    proj=all_p[-1] if all_p else None',
        // Stage detection
        'top=text[:2000]',
        'if re.search(r"Stage\\s*4\\s*(Project Readiness|Readiness and Approval|S4PRA)|S4PRA|Project Readiness and Approval",top,re.I): s=4',
        'elif re.search(r"Stage\\s*3\\s*(Solution|S3SA)|S3SA",top,re.I): s=3',
        'elif re.search(r"Stage\\s*2\\s*(Alternative|S2AA)|S2AA",top,re.I): s=2',
        'elif re.search(r"Stage\\s*1\\s*(Business|S1BA)|S1BA",top,re.I): s=1',
        'elif re.search(r"stage 4",top,re.I): s=4',
        'elif re.search(r"stage 3",top,re.I): s=3',
        'elif re.search(r"stage 2",top,re.I): s=2',
        'elif re.search(r"stage 1",top,re.I): s=1',
        'else: s=0',
        // Project name
        'nm=re.search(r"(?:Proposal|Project) Name[^:]*:\\s*([^\\n]+)",full,re.I)',
        'pname=nm.group(1).strip() if nm else ""',
        // Sub-label A/B
        'sublm=re.search(r"Stage\\s*[1-4]\\s*([AB])\\b|\\bPart\\s*([AB])\\b",top,re.I)',
        'sub=((sublm.group(1) or sublm.group(2) or "").upper()) if sublm else ""',
        'print(json.dumps({"project":proj,"stage":s,"project_name":pname,"sub_label":sub}))',
      ].join('\n');

      const out = execSync(
        `python3 -c '${pyScript.replace(/'/g, "'\\''")}' "${tmpFile}"`,
        { timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
      );
      result = JSON.parse(out.toString());
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    const stage: number = result.stage || 0;
    const abbrev = STAGE_ABBREV[stage] || 'OTHER';
    const sub = result.sub_label || '';
    const pname = result.project_name || '';
    const proj  = result.project || '';

    let canonical = '';
    if (proj) {
      const safeName = pname.replace(/[<>:"/\\|?*]/g,'').replace(/\s+/g,' ').trim().slice(0,60);
      canonical = `${proj} - ${abbrev}${sub} - ${safeName || proj}.pdf`;
    }

    return NextResponse.json({
      project_number: proj,
      stage,
      stage_label: STAGE_LABELS[stage] || '',
      abbrev: abbrev + sub,
      project_name: pname,
      canonical_filename: canonical,
    });
  } catch (err: any) {
    console.error('[preview-pdf]', err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
