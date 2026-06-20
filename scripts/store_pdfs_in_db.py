#!/usr/bin/env python3
"""Read already-downloaded PDFs from PAL_PDFs/ and store binaries in DB."""
import os, psycopg2
from pathlib import Path

DB_URL = os.environ["DATABASE_URL"]
PAL_DIR = Path("PAL_PDFs")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("""
    SELECT doc.document_id, doc.label, doc.filename, p.project_number
    FROM castateintel.pal_documents doc
    JOIN castateintel.pal_projects p ON p.id = doc.project_id
    WHERE doc.pdf_data IS NULL
    ORDER BY p.project_number, doc.stage DESC
""")
docs = cur.fetchall()
print(f"Found {len(docs)} documents without stored PDF binary.")

ok = skip = fail = 0
for doc_id, label, filename, proj_num in docs:
    folders = [d for d in PAL_DIR.iterdir() if d.name.startswith(proj_num)]
    if not folders: print(f"SKIP: no folder for {proj_num}"); skip += 1; continue

    label_slug = label.replace(" ", "_")
    pdfs = list(folders[0].glob("*.pdf"))
    match = next((f for f in pdfs if label_slug in f.name or label.split()[1] in f.name), None)
    if not match: print(f"SKIP: no PDF for {proj_num}/{label}"); skip += 1; continue

    print(f"Storing: {proj_num} / {label} ({match.stat().st_size // 1024} KB)...", end=" ", flush=True)
    try:
        pdf_bytes = match.read_bytes()
        cur.execute("""
            UPDATE castateintel.pal_documents
            SET pdf_data = %s,
                filename = %s,
                download_url = %s
            WHERE document_id = %s
        """, [pdf_bytes, match.name, f"/api/castateintel/pdf/{doc_id}", doc_id])
        conn.commit()
        print("OK")
        ok += 1
    except Exception as e:
        print(f"FAIL: {e}")
        conn.rollback(); fail += 1

cur.close(); conn.close()
print(f"\nDone. Stored: {ok}, Skipped: {skip}, Failed: {fail}")
