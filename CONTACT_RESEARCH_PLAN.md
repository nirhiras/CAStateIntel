# Contact Research & Enrichment Plan — Scale Phase

**Goal:** Enrich 656 remaining California government contacts with verified email, phone, and background information from free sources.

## Strategy Overview

### Research Methodology
1. **Free Source Priority:**
   - CA.gov official directories (primary)
   - Government agency websites and org charts
   - CALPENSIONS public database
   - LinkedIn public profiles (via Google search)
   - Secretary of State business records

2. **Contact Matching Approach:**
   - Match by name + organization combination
   - Verify against official titles
   - Cross-reference multiple sources for accuracy

3. **Data Quality Standards:**
   - Email: Official government directory or verified pattern
   - Phone: Government directory, agency main line, or direct extension
   - Background: Public LinkedIn, agency bios, news articles
   - Confidence: All sources must be publicly accessible

### Contact Prioritization

**Tier 1: High-Priority (328 contacts)**
- Role types: Director, Deputy Director, Secretary, Chief, Sponsor, Executive, Administrator
- Expected coverage: 75-85% email, 85-95% phone, 90%+ background
- Timeline: 1-2 weeks

**Tier 2: Standard (335 contacts)**
- Role types: Manager, Analyst, Specialist, Coordinator, Officer, Supervisor
- Expected coverage: 40-60% email, 50-70% phone, 70%+ background
- Timeline: 1-2 weeks

### Batch Processing Strategy

**Batch Size:** 50-100 contacts per research cycle
**Parallelization:** Multiple agents researching different batches simultaneously
**Frequency:** Daily research cycles until complete

---

## Free Sources Database

### 1. CA.gov Official Directory
- **URL:** https://ca.gov/state-organization/
- **Data:** Executive leadership, agency contacts, phone numbers
- **Coverage:** ~80% of senior staff
- **Format:** Public web directory, searchable by name/department
- **Cost:** FREE

### 2. Government Agency Websites
- **Pattern:** [agency].ca.gov
- **Data:** Staff directories, org charts, contact information
- **Coverage:** ~70% of employees
- **Format:** HTML pages, PDF org charts
- **Cost:** FREE

### 3. CALPENSIONS Public Database
- **URL:** https://www.calpensions.ca.gov/
- **Data:** Public employee salary data, names, positions, departments
- **Coverage:** ~85% of state employees
- **Format:** Searchable database
- **Cost:** FREE

### 4. LinkedIn Public Profiles
- **Method:** Google search: `site:linkedin.com [Name] California`
- **Data:** Job titles, work history, education, skills
- **Coverage:** ~60-70% of government professionals
- **Format:** Public profiles (no login required)
- **Cost:** FREE

### 5. Secretary of State Business Records
- **URL:** https://businesssearch.sos.ca.gov/
- **Data:** Registered agents, officers, business addresses
- **Coverage:** Contractors, consultants, vendors
- **Format:** Searchable database
- **Cost:** FREE

### 6. Government News & Press Releases
- **Pattern:** [agency].ca.gov/news
- **Data:** Staff announcements, organizational changes, expert bios
- **Coverage:** 30-40% for recent hires/changes
- **Format:** Web articles, PDF press releases
- **Cost:** FREE

---

## Research Workflow

### Phase 1: Batch Collection (Parallel)
```
Input: 50-100 contacts (name, title, organization, role_type)
Process:
  1. Search CA.gov directory for name + organization
  2. Check agency website org chart
  3. Query CALPENSIONS for public record
  4. Google search LinkedIn profile
  5. Cross-reference multiple sources
Output: Verified contact details with source attribution
```

### Phase 2: Data Validation
```
For each contact:
  ✓ Email format validation (firstname.lastname@[agency].ca.gov)
  ✓ Phone format validation ((XXX) XXX-XXXX)
  ✓ Organization name consistency
  ✓ Title verification against official sources
  ✓ Confidence scoring (high/medium/low)
```

### Phase 3: Database Population
```
For each validated record:
  - Match contact_id by name + organization
  - Update ai_email, ai_phone, ai_background, etc.
  - Set ai_enrichment_source = "Free sources: CA.gov, agency websites, CALPENSIONS, LinkedIn"
  - Set ai_enriched_at = NOW()
  - Preserve original email/phone from documents
```

### Phase 4: Gap Analysis & Reporting
```
After each batch:
  - Count enriched vs. unenriched
  - Identify unmatched contacts
  - Track coverage by agency/department
  - Flag low-confidence matches for manual review
```

---

## Expected Coverage by Source

### Email Coverage
- CA.gov Directory: 30-40%
- Agency websites: 20-30%
- CALPENSIONS: 15-20%
- Email pattern matching: 5-10%
- **Total expected: 70-85%**

### Phone Coverage
- CA.gov Directory: 40-50%
- Agency websites: 30-40%
- CALPENSIONS: 10-15%
- **Total expected: 80-90%**

### Background Coverage
- CALPENSIONS: 40-50%
- LinkedIn profiles: 30-40%
- Agency websites: 15-20%
- **Total expected: 85-95%**

---

## Implementation Timeline

### Week 1: High-Priority Batch 1-2 (160 contacts)
- Focus: Directors, executives, senior staff
- Expected enrichment: 120+ contacts (75%+)
- Target coverage: 80% email, 90% phone

### Week 2: High-Priority Batch 3-4 (168 contacts)
- Remaining directors and executives
- Expected enrichment: 130+ contacts (77%+)
- Target coverage: 80% email, 90% phone

### Week 3: Standard Batch 1-2 (160 contacts)
- Managers, analysts, specialists
- Expected enrichment: 90-100 contacts (55-65%)
- Target coverage: 50% email, 70% phone

### Week 4: Standard Batch 3-4 (175 contacts)
- Remaining standard roles
- Expected enrichment: 100+ contacts (60%+)
- Target coverage: 50% email, 70% phone

### Final: Gap Filling & Manual Research
- Unmatched contacts
- Low-confidence matches
- Priority agencies requiring deeper research

---

## Quality Assurance

### Verification Checklist
- [ ] Email matches government directory format
- [ ] Phone number matches (XXX) XXX-XXXX format
- [ ] Organization name verified against official sources
- [ ] Title matches current role in government databases
- [ ] Source attribution included for all fields
- [ ] No overwriting of original document data
- [ ] Timestamp recorded for audit trail

### Sample Validation
- Spot-check 10% of enriched contacts
- Cross-verify with agency websites
- Manual review of low-confidence matches
- Feedback loop for correction

---

## Deliverables

### Per Batch
1. **Enrichment Data File** (CSV/JSON)
   - contact_id, name, organization
   - ai_email, ai_phone, ai_background, etc.
   - ai_enrichment_source, ai_enriched_at

2. **Batch Report** (Markdown)
   - Total contacts processed
   - Enrichment coverage % by field
   - Agencies with highest/lowest coverage
   - List of unmatched contacts

3. **Database Updates** (SQL/API)
   - Direct updates to pal_contacts table
   - All ai_* columns populated
   - Original data preserved

### Final Deliverable
1. **Completion Report**
   - 656 contacts enriched
   - Final coverage statistics
   - Gap analysis and recommendations
   - Cost savings vs. paid services

---

## Cost Analysis

### Free Source Approach (Recommended)
- Cost: $0 (all free public sources)
- Coverage: 80-85% email, 85-90% phone
- Timeline: 4 weeks
- Labor: ~160 hours (automated research)

### Hybrid Approach (If Gaps Exist)
- Free sources: 80% coverage at $0
- Apollo.io for gaps: 15% coverage at $150-250
- Total cost: $150-250
- Total coverage: 95%+

### vs. Apollo.io Only
- Cost: $330 (663 × $0.50 per contact)
- Coverage: 95%+
- Timeline: 2-3 hours
- Trade-off: Zero insight into free source methodology

---

## Getting Started

### Option A: Automated Research (Recommended)
```bash
# Launch parallel research agents
# Each agent handles 50-100 contacts from different departments
# Agents research in parallel and report findings
# Central coordinator aggregates and populates database
```

### Option B: Manual + Assisted
```bash
# Focus on high-priority contacts first
# Research key executives manually using CA.gov + LinkedIn
# Use pattern-based email generation as fallback
# Populate database incrementally
```

### Option C: Hybrid + Escalation
```bash
# Free sources research for 80% coverage
# Identify gaps
# Use Apollo.io for final 15-20% if budget available
# Complete enrichment to 95%+
```

---

## Success Metrics

- ✅ 80%+ email addresses found (528+ contacts)
- ✅ 85%+ phone numbers found (563+ contacts)
- ✅ 90%+ background information enriched (597+ contacts)
- ✅ 0% overwrites of original document data
- ✅ 100% source attribution on all enriched fields
- ✅ <4 week timeline for complete enrichment
- ✅ $0 cost (free sources only)

---

**Status:** Ready to begin Phase 1 research  
**Data Source:** 656 unenriched contacts  
**First Batch:** 50-100 high-priority contacts  
**Recommended Approach:** Parallel agent-based research (fastest & most comprehensive)
