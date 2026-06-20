#!/usr/bin/env python3
"""Extract text from all PAL PDFs and save to Railway Postgres."""
import os, re, psycopg2
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    os.system("pip3 install pdfplumber --break-system-packages -q || pip3 install pdfplumber -q")
    import pdfplumber

DB_URL = os.environ.get("DATABASE_URL", "")
PAL_DIR = Path("PAL_PDFs")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("""
    SELECT doc.document_id, doc.label, p.project_number
    FROM castateintel.pal_documents doc
    JOIN castateintel.pal_projects p ON p.id = doc.project_id
    WHERE doc.content_text IS NULL
    ORDER BY p.project_number, doc.stage DESC
""")
docs = cur.fetchall()
print(f"Found {len(docs)} documents to extract.")

ok = skip = fail = 0
for doc_id, label, proj_num in docs:
    folders = [d for d in PAL_DIR.iterdir() if d.name.startswith(proj_num)]
    if not folders: print(f"SKIP: no folder for {proj_num}"); skip += 1; continue

    label_slug = label.replace(" ", "_")
    pdfs = list(folders[0].glob("*.pdf"))
    match = next((f for f in pdfs if label_slug in f.name or label.split()[1] in f.name), None)
    if not match: print(f"SKIP: no PDF for {proj_num}/{label}"); skip += 1; continue

    size_kb = match.stat().st_size // 1024
    print(f"Extracting: {proj_num} / {label} ({size_kb} KB)...", end=" ", flush=True)
    try:
        text = ""
        with pdfplumber.open(match) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        cur.execute("""
            UPDATE castateintel.pal_documents
            SET content_text=%s, file_size_kb=%s, downloaded_at=NOW(), updated_at=NOW()
            WHERE document_id=%s
        """, [text.strip(), size_kb, doc_id])
        conn.commit()
        print(f"OK ({len(text)} chars)")
        ok += 1
    except Exception as e:
        print(f"FAIL: {e}")
        conn.rollback(); fail += 1

cur.close(); conn.close()
print(f"\nDone. Extracted: {ok}, Skipped: {skip}, Failed: {fail}")
