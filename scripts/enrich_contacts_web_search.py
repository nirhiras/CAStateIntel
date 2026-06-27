#!/usr/bin/env python3
"""
Web-based Contact Enrichment using Exa API
Searches for LinkedIn profiles, government records, and background information
Free alternative to paid enrichment services
"""

import os
import sys
import json
import time
import psycopg2
import psycopg2.extras
from typing import Optional, Dict, Any, List

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def get_all_contacts(conn) -> List[Dict]:
    """Fetch contacts needing enrichment"""
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT
            c.contact_id, c.name, c.title, c.email, c.phone, c.organization,
            c.role_type, c.stage, p.project_number
        FROM castateintel.pal_contacts c
        JOIN castateintel.pal_projects p ON c.project_id = p.id
        WHERE c.name IS NOT NULL AND c.name != ''
        ORDER BY c.organization, c.name
    """)
    return cur.fetchall()

def build_search_queries(contact: Dict) -> List[Dict[str, str]]:
    """Build multiple search queries for a contact to find LinkedIn, government records, etc."""
    name = contact.get('name', '')
    title = contact.get('title', '')
    org = contact.get('organization', '')

    queries = []

    # LinkedIn search
    queries.append({
        'type': 'linkedin',
        'query': f'category:people LinkedIn profile {name} {title or ""}'.strip()
    })

    # Government employee search (California-specific)
    if org and 'california' in org.lower() or 'state' in org.lower() or 'ca ' in org.lower():
        queries.append({
            'type': 'government',
            'query': f'California {org} {name} {title} employee directory'.strip()
        })

    # Work history search
    queries.append({
        'type': 'background',
        'query': f'{name} {title or "professional"} work experience background'.strip()
    })

    # Email/contact search
    if not contact.get('email'):
        queries.append({
            'type': 'contact',
            'query': f'{name} {org} email contact information'.strip()
        })

    return queries

def format_enrichment_results(contact: Dict, search_results: Dict[str, Any]) -> Dict[str, Any]:
    """Format web search results into enrichment data"""
    enriched = {
        'contact_id': contact['contact_id'],
        'name': contact['name'],
        'title': contact['title'],
        'organization': contact['organization'],
        'email': contact.get('email'),  # Keep existing email
        'phone': contact.get('phone'),  # Keep existing phone
        'enrichment_sources': [],
        'linkedin_url': None,
        'background_summary': None,
        'web_references': []
    }

    # Process LinkedIn results
    if 'linkedin' in search_results and search_results['linkedin']:
        linkedin_result = search_results['linkedin'][0]
        if 'url' in linkedin_result:
            enriched['linkedin_url'] = linkedin_result['url']
            enriched['enrichment_sources'].append('LinkedIn')
        if 'text' in linkedin_result:
            enriched['web_references'].append({
                'source': 'LinkedIn',
                'url': linkedin_result.get('url'),
                'snippet': linkedin_result.get('text', '')[:500]
            })

    # Process background results
    if 'background' in search_results and search_results['background']:
        background_result = search_results['background'][0]
        enriched['background_summary'] = background_result.get('text', '')[:500]
        enriched['enrichment_sources'].append('Web Search')
        enriched['web_references'].append({
            'source': 'Web Search',
            'url': background_result.get('url'),
            'snippet': background_result.get('text', '')[:500]
        })

    # Process government records
    if 'government' in search_results and search_results['government']:
        gov_result = search_results['government'][0]
        enriched['enrichment_sources'].append('Government Records')
        enriched['web_references'].append({
            'source': 'Government Directory',
            'url': gov_result.get('url'),
            'snippet': gov_result.get('text', '')[:500]
        })

    return enriched

def update_contact_in_db(conn, enriched_data: Dict[str, Any]):
    """Update contact record with enriched data"""
    cur = conn.cursor()

    # Update phone and email if found
    if enriched_data.get('phone') or enriched_data.get('email'):
        cur.execute("""
            UPDATE castateintel.pal_contacts
            SET
                phone = COALESCE(%s, phone),
                email = COALESCE(%s, email),
                context = context || %s
            WHERE contact_id = %s
        """, (
            enriched_data.get('phone'),
            enriched_data.get('email'),
            json.dumps({
                'enrichment_sources': enriched_data['enrichment_sources'],
                'linkedin_url': enriched_data.get('linkedin_url'),
                'web_references': enriched_data['web_references']
            }),
            enriched_data['contact_id']
        ))
        conn.commit()

def main():
    print("═" * 70)
    print("CAStateIntel Contact Enrichment — Web Search (Exa)")
    print("═" * 70)

    if not DATABASE_URL:
        print("ERROR: Set DATABASE_URL environment variable")
        sys.exit(1)

    conn = get_db()

    try:
        print("\n📚 Fetching contacts...")
        contacts = get_all_contacts(conn)
        print(f"Found {len(contacts)} contacts to enrich")

        enriched_results = []
        skipped = 0

        print("\n🔍 Building search queries...")
        for i, contact in enumerate(contacts):
            print(f"  [{i+1}/{len(contacts)}] {contact['name']} ({contact['organization']})")

            queries = build_search_queries(contact)
            print(f"      → {len(queries)} search queries prepared")

            # Note: Actual Exa API calls would happen here via the MCP tool
            # This script prepares the data structure

            enriched_results.append({
                'contact': contact,
                'queries': queries,
                'status': 'pending'
            })

            # Rate limiting
            time.sleep(0.1)

        # Export search instructions
        output_file = "/tmp/contact_enrichment_web_search_jobs.json"
        with open(output_file, 'w') as f:
            json.dump(enriched_results, f, indent=2, default=str)

        print(f"\n✓ Search jobs prepared: {output_file}")
        print(f"   Ready for batch processing with Exa API")

        print("\n" + "═" * 70)
        print("NEXT: Run Exa searches via API and update database")
        print("═" * 70)
        print(f"""
To enrich via web search:
1. Use Exa API with prepared search queries
2. Parse LinkedIn profiles for work history
3. Extract contact info from government directories
4. Update CAStateIntel database with results

Available search types:
- LinkedIn profiles (work history, background)
- Government employee directories (California state)
- Company/organization records
- Professional networking sites
        """)

    finally:
        conn.close()

if __name__ == "__main__":
    main()
