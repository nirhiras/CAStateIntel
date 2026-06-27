#!/usr/bin/env python3
"""
Fetch unenriched contacts from CAStateIntel database for research
"""

import os
import sys
import json
from typing import List, Dict, Any

# Try to connect to database
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("ERROR: psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

def get_db_connection():
    """Create PostgreSQL connection"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    try:
        # Parse connection string
        from urllib.parse import urlparse
        parsed = urlparse(db_url)

        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            database=parsed.path.lstrip('/'),
            user=parsed.username,
            password=parsed.password
        )
        return conn
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        sys.exit(1)

def fetch_unenriched_contacts(limit: int = 100, offset: int = 0) -> List[Dict]:
    """
    Fetch contacts that haven't been enriched yet
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        query = """
        SELECT
            contact_id,
            name,
            title,
            organization,
            role_type,
            email,
            phone,
            CASE
                WHEN role_type IN ('Director', 'Sponsor', 'Executive', 'Chief', 'Deputy Director', 'Secretary', 'Administrator')
                THEN 'PRIORITY'
                ELSE 'STANDARD'
            END as priority_level
        FROM castateintel.pal_contacts
        WHERE name IS NOT NULL AND name != ''
        AND ai_enriched_at IS NULL
        ORDER BY priority_level, organization, name
        LIMIT %s OFFSET %s
        """

        cur.execute(query, (limit, offset))
        results = cur.fetchall()

        # Convert RealDictRow to dict
        return [dict(row) for row in results]
    finally:
        cur.close()
        conn.close()

def get_contact_counts() -> Dict[str, int]:
    """Get counts of enriched/unenriched contacts"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN ai_enriched_at IS NOT NULL THEN 1 END) as enriched,
            COUNT(CASE WHEN ai_enriched_at IS NULL THEN 1 END) as unenriched,
            COUNT(CASE WHEN role_type IN ('Director', 'Sponsor', 'Executive', 'Chief', 'Deputy Director', 'Secretary')
                  AND ai_enriched_at IS NULL THEN 1 END) as priority_unenriched
        FROM castateintel.pal_contacts
        WHERE name IS NOT NULL AND name != ''
        """)

        result = cur.fetchone()
        return dict(result) if result else {}
    finally:
        cur.close()
        conn.close()

def save_contacts_to_json(contacts: List[Dict], filename: str):
    """Save contacts to JSON file for research"""
    with open(filename, 'w') as f:
        json.dump(contacts, f, indent=2, default=str)
    print(f"✓ Saved {len(contacts)} contacts to {filename}")

def main():
    print("=" * 70)
    print("CAStateIntel Contact Fetcher")
    print("=" * 70)

    # Get counts
    counts = get_contact_counts()
    print(f"\nContact Statistics:")
    print(f"  Total contacts: {counts.get('total', 0)}")
    print(f"  Already enriched: {counts.get('enriched', 0)}")
    print(f"  Need enrichment: {counts.get('unenriched', 0)}")
    print(f"  High-priority unenriched: {counts.get('priority_unenriched', 0)}")

    # Fetch first batch of unenriched contacts
    print(f"\nFetching first 100 unenriched contacts...")
    contacts = fetch_unenriched_contacts(limit=100, offset=0)

    if not contacts:
        print("No unenriched contacts found!")
        return

    print(f"✓ Fetched {len(contacts)} contacts")

    # Separate by priority
    priority = [c for c in contacts if c['priority_level'] == 'PRIORITY']
    standard = [c for c in contacts if c['priority_level'] == 'STANDARD']

    print(f"  Priority contacts: {len(priority)}")
    print(f"  Standard contacts: {len(standard)}")

    # Save to JSON
    save_contacts_to_json(contacts, '/tmp/contacts_batch_1.json')
    save_contacts_to_json(priority, '/tmp/contacts_priority.json')

    # Display sample
    print(f"\nSample contacts (first 5):")
    for contact in contacts[:5]:
        print(f"  - {contact['name']:<30} | {contact['title']:<30} | {contact['organization'][:40]:<40}")

if __name__ == "__main__":
    main()
