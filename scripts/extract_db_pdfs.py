#!/usr/bin/env python3
"""Extract text from PDFs stored as binary in DB (uploaded via UI)."""
import os, io, psycopg2
import pdfplumber

DB_URL = os.environ["DATABASE_URL"]
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("""
    SELECT doc.document_id, doc.label, p.project_number
    FROM castateintel.pal_documents doc
    JOIN castateintel.pal_projects p ON p.id = doc.project_id
    WHERE doc.content_text IS NULL
    AND doc.pdf_data IS NOT NULL
""")
docs = cur.fetchall()
print(f"Found {len(docs)} DB-stored PDFs without extracted text.")

ok = fail = 0
for doc_id, label, proj_num in docs:
    cur2 = conn.cursor()
    cur2.execute("SELECT pdf_data, file_size_kb FROM castateintel.pal_documents WHERE document_id = %s", [doc_id])
    row = cur2.fetchone()
    pdf_bytes = bytes(row[0])
    size_kb = row[1] or len(pdf_bytes) // 1024

    print(f"Extracting: {proj_num} / {label} ({size_kb} KB)...", end=" ", flush=True)
    try:
        text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        cur.execute("""
            UPDATE castateintel.pal_documents
            SET content_text=%s, file_size_kb=%s, updated_at=NOW()
            WHERE document_id=%s
        """, [text.strip(), size_kb, doc_id])
        conn.commit()
        print(f"OK ({len(text)} chars)")
        ok += 1
    except Exception as e:
        print(f"FAIL: {e}")
        conn.rollback(); fail += 1

cur.close(); conn.close()
print(f"\nDone. Extracted: {ok}, Failed: {fail}")
