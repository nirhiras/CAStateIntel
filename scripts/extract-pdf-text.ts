import fs from 'fs';
import path from 'path';
import pool from '../lib/db';

const PAL_PDFS_DIR = path.join(process.cwd(), 'PAL_PDFs');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{text: string}> = (() => {
  const mod = require('pdf-parse');
  return typeof mod === 'function' ? mod : mod.default ?? mod;
})();

async function main() {
  const { rows: docs } = await pool.query(`
    SELECT doc.document_id, doc.label, p.project_number
    FROM castateintel.pal_documents doc
    JOIN castateintel.pal_projects p ON p.id = doc.project_id
    WHERE doc.content_text IS NULL
    ORDER BY p.project_number, doc.stage DESC
  `);

  console.log(`Found ${docs.length} documents without extracted text.`);
  let ok = 0, skip = 0, fail = 0;

  for (const doc of docs) {
    const projectDirs = fs.readdirSync(PAL_PDFS_DIR);
    const matchDir = projectDirs.find(d => d.startsWith(doc.project_number));
    if (!matchDir) { console.log(`SKIP: no folder for ${doc.project_number}`); skip++; continue; }

    const folder = path.join(PAL_PDFS_DIR, matchDir);
    const files = fs.readdirSync(folder).filter(f => f.endsWith('.pdf'));
    const labelSlug = doc.label.replace(/\s+/g, '_');
    const matchFile = files.find(f => f.includes(labelSlug) || f.includes(doc.label.split(' ')[1]));
    if (!matchFile) { console.log(`SKIP: no PDF for ${doc.project_number} / ${doc.label}`); skip++; continue; }

    const filePath = path.join(folder, matchFile);
    const sizeKb = Math.round(fs.statSync(filePath).size / 1024);
    console.log(`Extracting: ${doc.project_number} / ${doc.label} (${sizeKb} KB)...`);
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      await pool.query(`
        UPDATE castateintel.pal_documents
        SET content_text=$1, file_size_kb=$2, downloaded_at=NOW(), updated_at=NOW()
        WHERE document_id=$3
      `, [data.text.trim(), sizeKb, doc.document_id]);
      console.log(`  OK: ${data.text.length} chars`);
      ok++;
    } catch (err) {
      console.error(`  FAIL: ${err}`);
      fail++;
    }
  }

  console.log(`\nDone. Extracted: ${ok}, Skipped: ${skip}, Failed: ${fail}`);
  await pool.end();
}

main().catch(console.error);
