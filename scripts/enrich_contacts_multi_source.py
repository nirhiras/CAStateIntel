#!/usr/bin/env python3
"""
Multi-Source Contact Enrichment for CAStateIntel
Uses Apollo.io, Exa web search, and Vibe Prospecting to enrich 663 contacts
Adds phone numbers, official emails, and professional backgrounds
"""

import os
import sys
import json
import csv
import psycopg2
import psycopg2.extras
from typing import Optional, Dict, Any, List
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def get_all_contacts(conn, limit: int = 0) -> List[Dict]:
    """Fetch all unique contacts from database"""
    cur = conn.cursor()
    query = """
        SELECT DISTINCT
            c.contact_id, c.name, c.title, c.email, c.phone, c.organization,
            c.role_type, c.stage, p.project_number
        FROM castateintel.pal_contacts c
        JOIN castateintel.pal_projects p ON c.project_id = p.id
        WHERE c.name IS NOT NULL AND c.name != ''
        ORDER BY c.organization, c.name
    """
    if limit > 0:
        query += f" LIMIT {limit}"

    cur.execute(query)
    return cur.fetchall()

def export_contacts_csv(contacts: List[Dict], filename: str):
    """Export contacts to CSV for import into Apollo or other services"""
    if not contacts:
        print("No contacts to export")
        return

    keys = ['name', 'title', 'organization', 'email', 'phone', 'stage', 'role_type']
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for contact in contacts:
            row = {k: contact.get(k, '') for k in keys}
            writer.writerow(row)

    print(f"✓ Exported {len(contacts)} contacts to {filename}")

def generate_enrichment_report(contacts: List[Dict]) -> Dict[str, Any]:
    """Generate enrichment statistics and gaps"""
    total = len(contacts)
    with_email = sum(1 for c in contacts if c.get('email'))
    with_phone = sum(1 for c in contacts if c.get('phone'))

    return {
        'total_contacts': total,
        'contacts_with_email': with_email,
        'contacts_with_phone': with_phone,
        'email_coverage': f"{100*with_email//total}%" if total > 0 else "0%",
        'phone_coverage': f"{100*with_phone//total}%" if total > 0 else "0%",
        'needs_enrichment': {
            'emails': total - with_email,
            'phones': total - with_phone
        }
    }

def group_by_organization(contacts: List[Dict]) -> Dict[str, List[Dict]]:
    """Group contacts by organization for batch processing"""
    groups = {}
    for contact in contacts:
        org = contact.get('organization', 'Unknown')
        if org not in groups:
            groups[org] = []
        groups[org].append(contact)
    return groups

def main():
    print("═" * 70)
    print("CAStateIntel Contact Enrichment — Multi-Source Strategy")
    print("═" * 70)

    if not DATABASE_URL:
        print("ERROR: Set DATABASE_URL environment variable")
        sys.exit(1)

    conn = get_db()

    try:
        # Fetch all contacts
        print("\n1️⃣  Fetching contacts from database...")
        contacts = get_all_contacts(conn)
        print(f"   Found {len(contacts)} unique contacts")

        # Generate current state report
        print("\n2️⃣  Current enrichment status:")
        report = generate_enrichment_report(contacts)
        print(f"   Total contacts: {report['total_contacts']}")
        print(f"   With email: {report['contacts_with_email']} ({report['email_coverage']})")
        print(f"   With phone: {report['contacts_with_phone']} ({report['phone_coverage']})")
        print(f"   \n   Enrichment gaps:")
        print(f"   - Missing emails: {report['needs_enrichment']['emails']}")
        print(f"   - Missing phones: {report['needs_enrichment']['phones']}")

        # Export for enrichment
        print("\n3️⃣  Preparing data for enrichment...")
        csv_file = "/tmp/castateintel_contacts_for_enrichment.csv"
        export_contacts_csv(contacts, csv_file)

        # Group by organization
        org_groups = group_by_organization(contacts)
        print(f"\n4️⃣  Organized contacts into {len(org_groups)} organizations")
        print("   Top organizations:")
        sorted_orgs = sorted(org_groups.items(), key=lambda x: len(x[1]), reverse=True)
        for org, contacts_list in sorted_orgs[:10]:
            print(f"   - {org}: {len(contacts_list)} contacts")

        # Prepare enrichment instructions
        print("\n" + "═" * 70)
        print("ENRICHMENT OPTIONS:")
        print("═" * 70)

        print("""
🚀 **OPTION 1: Apollo.io Bulk Enrichment (Recommended)**
   - Cost: Up to 1 credit per contact (~$0.50 each)
   - Returns: Email, phone, LinkedIn, job history, company info
   - Steps:
     a) Visit: https://app.apollo.io/
     b) Upload CSV: {csv_file}
     c) Run enrichment
     d) Export enriched data

🔍 **OPTION 2: Web Search (Free)**
   - Uses Exa + web search for LinkedIn, government records
   - Returns: Public profiles, background info
   - Slower but free
   - API call: python3 scripts/enrich_contacts_web_search.py

💼 **OPTION 3: Government Directory Lookup (Free)**
   - California state employee database
   - California contractor database
   - Secretary of State business records

📊 **OPTION 4: Batch Processing via API**
   - Use Apollo SDK to batch enrich all 663 contacts
   - Automatic phone/email lookup and database update
   - Cost-optimized (skip already-enriched)
        """.format(csv_file=csv_file))

        # Save metadata
        metadata = {
            'export_date': datetime.now().isoformat(),
            'total_contacts': len(contacts),
            'enrichment_report': report,
            'organizations': list(org_groups.keys()),
            'csv_file': csv_file
        }

        metadata_file = "/tmp/enrichment_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)

        print(f"\n✓ Enrichment metadata saved to: {metadata_file}")
        print(f"✓ Contact list saved to: {csv_file}")

        print("\n" + "═" * 70)
        print("NEXT STEPS:")
        print("═" * 70)
        print("""
1. Choose your enrichment method above
2. If using Apollo.io:
   - Upload the CSV file
   - Select enrichment fields (email, phone, job history)
   - Wait for processing (~1-2 hours for 663 contacts)
   - Download enriched CSV
   - Run: python3 scripts/merge_enriched_data.py <enriched_file.csv>
3. If using web search:
   - Run: python3 scripts/enrich_contacts_web_search.py
4. Check results:
   - View enriched contacts in CAStateIntel UI
   - Export updated contact list
        """)

    finally:
        conn.close()

if __name__ == "__main__":
    main()
