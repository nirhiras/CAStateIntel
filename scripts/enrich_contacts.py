#!/usr/bin/env python3
"""
Contact Enrichment Script — Apollo.io Integration
Enriches CAStateIntel contacts with phone, email, and background data
"""

import os
import sys
import json
import csv
import time
import requests
import psycopg2
import psycopg2.extras
from typing import Optional, Dict, Any

DATABASE_URL = os.environ.get("DATABASE_URL")
APOLLO_API_KEY = os.environ.get("APOLLO_API_KEY")
APOLLO_BASE = "https://api.apollo.io/v1"

def get_db():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def get_all_contacts(conn):
    """Fetch all unique contacts from database"""
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT
            contact_id, name, title, email, phone, organization, 
            role_type, stage, project_number
        FROM castateintel.pal_contacts c
        JOIN castateintel.pal_projects p ON c.project_id = p.id
        WHERE c.name IS NOT NULL AND c.name != ''
        ORDER BY organization, name
    """)
    return cur.fetchall()

def search_apollo(name: str, title: Optional[str], organization: Optional[str]) -> Optional[Dict]:
    """Search Apollo.io for a contact"""
    if not APOLLO_API_KEY:
        print("  ⚠ APOLLO_API_KEY not set — skipping enrichment")
        return None
    
    try:
        # Apollo people search endpoint
        response = requests.post(
            f"{APOLLO_BASE}/people/search",
            headers={
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
            },
            json={
                "api_key": APOLLO_API_KEY,
                "first_name": name.split()[0] if name else "",
                "last_name": " ".join(name.split()[1:]) if len(name.split()) > 1 else "",
                "organization_name": organization,
                "title": title,
                "limit": 1
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("people") and len(data["people"]) > 0:
                person = data["people"][0]
                return {
                    "phone": person.get("phone_numbers", [None])[0],
                    "email": person.get("email"),
                    "emails": person.get("emails", []),
                    "organization": person.get("organization", {}).get("name"),
                    "title": person.get("title"),
                    "linkedin_url": person.get("linkedin_url"),
                    "background": {
                        "current_company": person.get("organization", {}).get("name"),
                        "job_history": person.get("past_experience", [])
                    }
                }
    except Exception as e:
        print(f"  Error searching Apollo: {e}")
    
    return None

def enrich_contacts(conn):
    """Main enrichment process"""
    print("Fetching all contacts...")
    contacts = get_all_contacts(conn)
    print(f"Found {len(contacts)} unique contacts")
    
    enriched = []
    matched = 0
    unmatched = 0
    
    print("\nEnriching contacts...")
    for i, contact in enumerate(contacts):
        print(f"  [{i+1}/{len(contacts)}] {contact['name']} at {contact['organization']}")
        
        # Rate limit Apollo API
        time.sleep(0.5)
        
        result = search_apollo(
            contact['name'],
            contact['title'],
            contact['organization']
        )
        
        if result:
            matched += 1
            enriched_record = {**contact, **result}
            enriched.append(enriched_record)
            
            # Update database
            cur = conn.cursor()
            cur.execute("""
                UPDATE castateintel.pal_contacts
                SET phone = %s, email = %s
                WHERE contact_id = %s
            """, (
                result.get("phone"),
                result.get("email") or contact.get("email"),
                contact['contact_id']
            ))
            conn.commit()
            print(f"    ✓ Updated: {result.get('email') or 'no email'} | {result.get('phone') or 'no phone'}")
        else:
            unmatched += 1
            enriched.append(contact)
            print(f"    — No match found")
    
    # Export to CSV
    output_file = "/tmp/contacts_enriched.csv"
    if enriched:
        keys = enriched[0].keys()
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(enriched)
        print(f"\nExported {len(enriched)} contacts to {output_file}")
    
    print(f"\n📊 Results:")
    print(f"  Matched: {matched}/{len(contacts)}")
    print(f"  Unmatched: {unmatched}/{len(contacts)}")
    print(f"  Success Rate: {100*matched//len(contacts)}%")

if __name__ == "__main__":
    if not DATABASE_URL:
        print("ERROR: Set DATABASE_URL environment variable")
        sys.exit(1)
    
    conn = get_db()
    try:
        enrich_contacts(conn)
    finally:
        conn.close()
