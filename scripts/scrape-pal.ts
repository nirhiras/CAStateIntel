import https from 'https';
import fs from 'fs';
import path from 'path';
import { upsertProject, upsertDocument, logScrape } from '../lib/castateintel/queries';
import pool from '../lib/db';

const BASE_URL = 'https://projecttracking.technology.ca.gov';
const PAL_PDFS_DIR = path.join(process.cwd(), 'PAL_PDFs');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS }, (res) => {
      if (res.statusCode === 404) return reject(new Error('404'));
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function downloadFile(url: string, dest: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: HEADERS }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(Math.round(fs.statSync(dest).size / 1024)); });
    }).on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseDetailLinks(html: string) {
  const links: Array<{ name: string; url: string }> = [];
  const regex = /href="(\/Home\/PALDetails\?id=[^"]+)"[^>]*>([^<]+)</g;
  let m;
  while ((m = regex.exec(html)) !== null) links.push({ url: BASE_URL + m[1], name: m[2].trim() });
  return links;
}

function parseProjectDetails(html: string, projectUrl: string) {
  const h2Match = html.match(/<h2[^>]*>([\d\-]+)\s+(.+?)<\/h2>/i);
  const projectNumber = h2Match?.[1]?.trim() ?? '';
  const name = h2Match?.[2]?.trim() ?? '';
  const stageMatch = html.match(/Stage\s+[123]/);
  const palStage = stageMatch ? stageMatch[0] : 'Stage 1';
  const docRegex = /href="(\/Home\/DownloadProposal\?documentid=([a-f0-9\-]+)&projectid=[^"]+)"[^>]*>\s*([^<]+)</g;
  const docs: Array<{ label: string; documentId: string; url: string; stage: number }> = [];
  let dm;
  while ((dm = docRegex.exec(html)) !== null) {
    const label = dm[3].trim().replace(' (pdf)', '');
    const stageNum = label.includes('Stage 3') ? 3 : label.includes('Stage 2') ? 2 : 1;
    docs.push({ label, documentId: dm[2], url: BASE_URL + dm[1], stage: stageNum });
  }
  return { projectNumber, name, palStage, detailUrl: projectUrl, docs };
}

async function main() {
  console.log(`[${new Date().toISOString()}] PAL scrape started`);
  fs.mkdirSync(PAL_PDFS_DIR, { recursive: true });
  let projectsFound = 0, docsFound = 0, docsDownloaded = 0, errors = 0;

  const listingHtml = await fetchUrl(`${BASE_URL}/PAL`);
  const links = parseDetailLinks(listingHtml);
  projectsFound = links.length;
  console.log(`Found ${links.length} projects`);

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    console.log(`\n[${i+1}/${links.length}] ${link.name}`);
    try {
      const html = await fetchUrl(link.url);
      const { projectNumber, name, palStage, detailUrl, docs } = parseProjectDetails(html, link.url);
      if (!projectNumber) { errors++; continue; }

      await upsertProject({ projectNumber, name, palStage, detailUrl, departmentOrgCode: projectNumber.split('-')[0] });
      docsFound += docs.length;

      for (const doc of docs) {
        await upsertDocument({ projectNumber, stage: doc.stage, label: doc.label, documentId: doc.documentId, downloadUrl: doc.url });
        const safe = (s: string) => s.replace(/[^\w\-]/g, '_').slice(0, 40);
        const folder = path.join(PAL_PDFS_DIR, `${projectNumber}_${safe(name)}`);
        fs.mkdirSync(folder, { recursive: true });
        const dest = path.join(folder, `${doc.label.replace(/\s+/g, '_')}.pdf`);
        if (!fs.existsSync(dest)) {
          try { await downloadFile(doc.url, dest); docsDownloaded++; console.log(`  Downloaded: ${doc.label}`); }
          catch { errors++; }
        }
      }
      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== '404') console.error(`  ERROR: ${msg}`);
      errors++;
      await sleep(1500);
    }
  }

  await logScrape({ scrapeType: 'full_listing', targetUrl: `${BASE_URL}/PAL`, projectsFound, docsFound, docsDownloaded, errors });
  console.log(`\nDone: ${projectsFound} projects, ${docsFound} docs, ${docsDownloaded} downloaded, ${errors} errors`);
  await pool.end();
}

main().catch(console.error);
