import pool from '../db';

export type PalProject = {
  id: number;
  project_number: string;
  name: string;
  description: string | null;
  pal_stage: string;
  criticality_rating: string;
  status: string;
  detail_url: string;
  department_name: string;
  agency_name: string;
  doc_count: number;
  first_seen_at: string;
  updated_at: string;
};

export type PalDocument = {
  id: number;
  project_id: number;
  project_number: string;
  project_name: string;
  stage: number;
  label: string;
  document_id: string;
  download_url: string;
  file_size_kb: number | null;
  downloaded_at: string | null;
  content_text: string | null;
};

export async function getAllProjects(filters?: {
  stage?: string;
  status?: string;
  search?: string;
}): Promise<PalProject[]> {
  let query = `
    SELECT
      p.id, p.project_number, p.name, p.description,
      p.pal_stage, p.criticality_rating, p.status, p.detail_url,
      p.first_seen_at, p.updated_at,
      d.name AS department_name,
      a.name AS agency_name,
      COUNT(doc.id)::int AS doc_count
    FROM castateintel.pal_projects p
    LEFT JOIN castateintel.departments d ON d.id = p.department_id
    LEFT JOIN castateintel.agencies a ON a.id = d.agency_id
    LEFT JOIN castateintel.pal_documents doc ON doc.project_id = p.id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (filters?.stage) { params.push(filters.stage); query += ` AND p.pal_stage = $${params.length}`; }
  if (filters?.status) { params.push(filters.status); query += ` AND p.status = $${params.length}`; }
  if (filters?.search) { params.push(`%${filters.search}%`); query += ` AND (p.name ILIKE $${params.length} OR p.project_number ILIKE $${params.length})`; }
  query += ` GROUP BY p.id, d.name, a.name ORDER BY p.pal_stage DESC, p.project_number`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function getProjectByNumber(projectNumber: string) {
  const { rows: projects } = await pool.query(`
    SELECT p.*, d.name AS department_name, d.org_code, a.name AS agency_name, a.code AS agency_code
    FROM castateintel.pal_projects p
    LEFT JOIN castateintel.departments d ON d.id = p.department_id
    LEFT JOIN castateintel.agencies a ON a.id = d.agency_id
    WHERE p.project_number = $1
  `, [projectNumber]);
  if (!projects[0]) return null;
  const { rows: documents } = await pool.query(
    `SELECT * FROM castateintel.pal_documents WHERE project_id = $1 ORDER BY stage DESC`,
    [projects[0].id]
  );
  return { ...projects[0], documents };
}

export async function getAllDocuments(filters?: { stage?: number; projectNumber?: string }): Promise<PalDocument[]> {
  let query = `
    SELECT
      doc.id, doc.document_id, doc.stage, doc.label,
      COALESCE(doc.sub_label, '') AS sub_label,
      COALESCE(doc.doc_type, 'stage') AS doc_type,
      doc.short_description, doc.filename, doc.downloaded_at,
      length(COALESCE(doc.content_text,'')) AS content_length,
      doc.content_text,
      p.project_number, p.name AS project_name,
      COALESCE(dept.name, '') AS department_name,
      -- contact count for this document
      (SELECT COUNT(*)::int FROM castateintel.pal_contacts ct
       WHERE ct.document_id::text = doc.document_id::text) AS contact_count,
      -- procurement count for this project+stage  
      (SELECT COUNT(*)::int FROM castateintel.pal_ancillary_procurements ap
       WHERE ap.project_id = doc.project_id AND ap.stage = doc.stage) AS procurement_count,
      -- tags from stage analysis (safe with jsonb_typeof guard)
      CASE doc.stage
        WHEN 1 THEN (
          SELECT COALESCE(jsonb_agg(elem->>'tag'),'[]'::jsonb)
          FROM castateintel.pal_stage1_analysis sa
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN sa.solution_tags IS NOT NULL AND jsonb_typeof(sa.solution_tags)='array'
            THEN sa.solution_tags ELSE '[]'::jsonb END) AS elem
          WHERE sa.project_id = doc.project_id LIMIT 1)
        WHEN 2 THEN (
          SELECT COALESCE(jsonb_agg(elem->>'tag'),'[]'::jsonb)
          FROM castateintel.pal_stage2_analysis sa
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN sa.solution_tags IS NOT NULL AND jsonb_typeof(sa.solution_tags)='array'
            THEN sa.solution_tags ELSE '[]'::jsonb END) AS elem
          WHERE sa.project_id = doc.project_id LIMIT 1)
        WHEN 3 THEN (
          SELECT COALESCE(jsonb_agg(elem->>'tag'),'[]'::jsonb)
          FROM castateintel.pal_stage3_analysis sa
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN sa.solution_tags IS NOT NULL AND jsonb_typeof(sa.solution_tags)='array'
            THEN sa.solution_tags ELSE '[]'::jsonb END) AS elem
          WHERE sa.project_id = doc.project_id LIMIT 1)
        ELSE '[]'::jsonb
      END AS solution_tags
    FROM castateintel.pal_documents doc
    JOIN castateintel.pal_projects p ON p.id = doc.project_id
    LEFT JOIN castateintel.departments dept ON dept.id = p.department_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (filters?.stage) { params.push(filters.stage); query += ` AND doc.stage = $${params.length}`; }
  if (filters?.projectNumber) { params.push(filters.projectNumber); query += ` AND p.project_number = $${params.length}`; }
  query += ` ORDER BY p.project_number, doc.stage DESC`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function searchDocuments(query: string) {
  const { rows } = await pool.query(`
    SELECT doc.id, doc.label, doc.stage, doc.download_url,
      p.project_number, p.name AS project_name, p.pal_stage,
      ts_headline('english', doc.content_text, plainto_tsquery('english', $1), 'MaxWords=50, MinWords=20') AS headline
    FROM castateintel.pal_documents doc
    JOIN castateintel.pal_projects p ON p.id = doc.project_id
    WHERE to_tsvector('english', COALESCE(doc.content_text, '')) @@ plainto_tsquery('english', $1)
    ORDER BY ts_rank(to_tsvector('english', COALESCE(doc.content_text, '')), plainto_tsquery('english', $1)) DESC
    LIMIT 20
  `, [query]);
  return rows;
}

export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(DISTINCT p.id)::int AS total_projects,
      COUNT(DISTINCT CASE WHEN p.pal_stage = 'Stage 3' THEN p.id END)::int AS stage3_count,
      COUNT(DISTINCT CASE WHEN p.pal_stage = 'Stage 2' THEN p.id END)::int AS stage2_count,
      COUNT(DISTINCT CASE WHEN p.pal_stage = 'Stage 1' THEN p.id END)::int AS stage1_count,
      COUNT(doc.id)::int AS total_documents,
      COUNT(CASE WHEN doc.content_text IS NOT NULL THEN 1 END)::int AS extracted_docs
    FROM castateintel.pal_projects p
    LEFT JOIN castateintel.pal_documents doc ON doc.project_id = p.id
  `);
  return rows[0];
}

export async function upsertProject(data: {
  projectNumber: string; name: string; description?: string;
  palStage: string; criticalityRating?: string; detailUrl: string; departmentOrgCode?: string;
}) {
  await pool.query(`
    INSERT INTO castateintel.pal_projects
      (project_number, name, description, pal_stage, criticality_rating, detail_url, department_id, status, last_seen_at)
    VALUES ($1,$2,$3,$4,$5,$6,(SELECT id FROM castateintel.departments WHERE org_code=$7 LIMIT 1),'Active',NOW())
    ON CONFLICT (project_number) DO UPDATE SET
      name=EXCLUDED.name, pal_stage=EXCLUDED.pal_stage,
      detail_url=EXCLUDED.detail_url, last_seen_at=NOW(), updated_at=NOW()
  `, [data.projectNumber, data.name, data.description ?? null, data.palStage,
      data.criticalityRating ?? null, data.detailUrl, data.departmentOrgCode ?? null]);
}

export async function upsertDocument(data: {
  projectNumber: string; stage: number; label: string; documentId: string; downloadUrl: string;
}) {
  await pool.query(`
    INSERT INTO castateintel.pal_documents (project_id, stage, label, document_id, download_url)
    VALUES ((SELECT id FROM castateintel.pal_projects WHERE project_number=$1),$2,$3,$4,$5)
    ON CONFLICT (project_id, stage, document_id) DO NOTHING
  `, [data.projectNumber, data.stage, data.label, data.documentId, data.downloadUrl]);
}

export async function logScrape(data: {
  scrapeType: string; targetUrl?: string; projectsFound?: number;
  docsFound?: number; docsDownloaded?: number; errors?: number; notes?: string;
}) {
  const { rows } = await pool.query(`
    INSERT INTO castateintel.scrape_log
      (scrape_type, target_url, projects_found, docs_found, docs_downloaded, errors, notes, completed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id
  `, [data.scrapeType, data.targetUrl ?? null, data.projectsFound ?? 0,
      data.docsFound ?? 0, data.docsDownloaded ?? 0, data.errors ?? 0, data.notes ?? null]);
  return rows[0].id;
}
