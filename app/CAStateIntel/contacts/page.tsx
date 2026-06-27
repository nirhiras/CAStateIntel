'use client';
import { useEffect, useState } from 'react';

const T = {
  canvas:'#0d0d0d', surface:'#161616', border:'#2a2a2a',
  accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', accentBdr:'rgba(0,217,146,0.35)',
  ink:'#f0f0f0', mute:'#cccccc', faint:'#aaaaaa', red:'#ef4444',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
};
const ROLE_COLOR: Record<string,string> = {
  sponsor:'#a78bfa', stakeholder:'#60a5fa', reviewer:'#34d399', contact:'#f0f0f0', other:'#999',
};
type Contact = {
  contact_id:string; project_number:string; project_name:string;
  stage:number; name:string; title:string; email:string; phone:string;
  organization:string; role_type:string; doc_created_date:string;
  ai_email?:string; ai_phone?:string; ai_background?:string;
  ai_technical_skills?:string; ai_prior_roles?:string; ai_education?:string;
  ai_enriched_at?:string;
};
function fmtDate(s:string) {
  if (!s||s==='null') return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
const DQUOTE = String.fromCharCode(34);
const NEWLINE = String.fromCharCode(10);
function esc(v:unknown){const s=String(v||'');return(s.includes(',')||s.includes(DQUOTE))?(DQUOTE+s.replace(/"/g,DQUOTE+DQUOTE)+DQUOTE):s;}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [stageF, setStageF]     = useState('');
  const [roleF, setRoleF]       = useState('');
  const [orgF, setOrgF]         = useState('');
  const [dateF, setDateF]       = useState('');
  const [sortKey, setSortKey]   = useState<keyof Contact>('name');
  const [sortDir, setSortDir]   = useState<'asc'|'desc'>('asc');

  useEffect(() => {
    fetch('/api/castateintel/contacts').then(r=>r.json())
      .then(d=>{setContacts(Array.isArray(d)?d:(d.contacts||[]));setLoading(false);})
      .catch(()=>setLoading(false));
  }, []);

  const allOrgs  = [...new Set(contacts.map(c=>c.organization).filter(Boolean))].sort();
  const allRoles = [...new Set(contacts.map(c=>c.role_type).filter(Boolean))].sort();

  const filtered = contacts.filter(c=>
    (!search||[c.name,c.email,c.title,c.organization].some(f=>f?.toLowerCase().includes(search.toLowerCase())))&&
    (!stageF||String(c.stage)===stageF)&&(!roleF||c.role_type===roleF)&&(!orgF||c.organization===orgF)&&
    (!dateF||String(c.doc_created_date||'').startsWith(dateF))
  );
  const sorted = [...filtered].sort((a,b)=>{
    const av=String(a[sortKey]||''), bv=String(b[sortKey]||'');
    return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
  });

  const toggleSort = (k:keyof Contact) => {
    if(k===sortKey) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortKey(k);setSortDir('asc');}
  };

  const exportCSV = () => {
    const hdr = ['Name','Title','Org','Email','Phone','AI Email','AI Phone','Background','Technical Skills','Role','Stage','Date','Project'].join(',');
    const rows = sorted.map(c=>[c.name,c.title,c.organization,c.email,c.phone,c.ai_email||'',c.ai_phone||'',c.ai_background||'',c.ai_technical_skills||'',c.role_type,'Stage '+c.stage,c.doc_created_date,c.project_number+' - '+c.project_name].map(esc).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[hdr,...rows].join(NEWLINE)],{type:'text/csv'}));
    a.download = 'pal_contacts.csv'; a.click();
  };

  const Th = ({k,label}:{k:keyof Contact;label:string}) => (
    <th onClick={()=>toggleSort(k)} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:sortKey===k?T.accent:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,cursor:'pointer',whiteSpace:'nowrap'}}>
      {label}{sortKey===k?(sortDir==='asc'?' ↑':' ↓'):''}
    </th>
  );

  return (
    <div style={{minHeight:'100vh',background:T.canvas,color:T.ink,fontFamily:T.font}}>
      {/* Header */}
      {/* Breadcrumb */}
      <div style={{padding:'12px 32px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8}}>
        <a href="/CAStateIntel" style={{color:T.mute,fontSize:12,textDecoration:'none'}}>Dashboard</a>
        <span style={{color:'#444',fontSize:12}}>›</span>
        <a href="/CAStateIntel/pal" style={{color:T.mute,fontSize:12,textDecoration:'none'}}>PAL Docs</a>
        <span style={{color:'#444',fontSize:12}}>›</span>
        <span style={{color:T.accent,fontSize:12,fontWeight:600}}>All Contacts</span>
      </div>
      <div style={{borderBottom:`1px solid ${T.border}`,padding:'24px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:T.accent,fontWeight:600,marginBottom:4}}>Contacts</div>
          <h1 style={{fontSize:24,fontWeight:700,letterSpacing:'-0.5px',color:T.ink,margin:0}}>
            {loading?'Loading…':`${sorted.length} of ${contacts.length} contacts`}
          </h1>
          <p style={{fontSize:13,color:T.mute,marginTop:4}}>Extracted from PAL documents across all stages</p>
        </div>
        <button onClick={exportCSV} style={{padding:'8px 16px',borderRadius:6,fontSize:13,fontWeight:600,border:`1px solid ${T.border}`,background:'transparent',color:T.ink,cursor:'pointer',fontFamily:T.font}}>
          ⬇ Export CSV
        </button>
      </div>
      {/* Filters */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'12px 32px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, email, org…"
            style={{height:36,padding:'0 10px 0 30px',borderRadius:6,border:`1px solid ${T.border}`,background:T.canvas,color:T.ink,fontSize:13,fontFamily:T.font,outline:'none',width:220}}/>
        </div>
        {([
          {label:'All Stages',val:stageF,set:setStageF,opts:['1','2','3','4'].map(v=>({v,l:`Stage ${v}`}))},
          {label:'All Roles', val:roleF, set:setRoleF, opts:allRoles.map(v=>({v,l:v}))},
          {label:'All Orgs',  val:orgF,  set:setOrgF,  opts:allOrgs.map(v=>({v,l:v}))},
        ] as {label:string;val:string;set:(s:string)=>void;opts:{v:string;l:string}[]}[]).map(f=>(
          <select key={f.label} value={f.val} onChange={e=>f.set(e.target.value)}
            style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${f.val?T.accentBdr:T.border}`,background:f.val?T.accentDim:T.canvas,color:f.val?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none',maxWidth:200}}>
            <option value="">{f.label}</option>
            {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
        {/* Year filter */}
        <select value={dateF} onChange={e=>setDateF(e.target.value)}
          style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${dateF?T.accentBdr:T.border}`,background:dateF?T.accentDim:T.canvas,color:dateF?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none'}}>
          <option value="">All Years</option>
          {['2019','2020','2021','2022','2023','2024','2025','2026'].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        {(search||stageF||roleF||orgF||dateF)&&(
          <button onClick={()=>{setSearch('');setStageF('');setRoleF('');setOrgF('');setDateF('');}} style={{height:36,padding:'0 10px',borderRadius:6,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:T.red,fontSize:13,cursor:'pointer',fontFamily:T.font}}>
            ✕ Clear
          </button>
        )}
        <span style={{fontSize:13,color:T.ink,marginLeft:'auto'}}><span style={{color:T.ink,fontWeight:700}}>{sorted.length}</span> contacts</span>
      </div>
      {/* Table */}
      <div style={{padding:'24px 32px 64px'}}>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
              <thead>
                <tr>
                  <Th k="name"             label="Name"/>
                  <Th k="title"            label="Title"/>
                  <Th k="organization"     label="Organization"/>
                  <Th k="email"            label="Email"/>
                  <Th k="phone"            label="Phone"/>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.accent,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>AI Email</th>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.accent,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>AI Phone</th>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.accent,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>Background</th>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.accent,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>Technical Skills</th>
                  <Th k="role_type"        label="Role"/>
                  <Th k="stage"            label="Stage"/>
                  <Th k="doc_created_date" label="Form Received"/>
                  <Th k="project_number"   label="Source"/>
                </tr>
              </thead>
              <tbody>
                {loading?(
                  <tr><td colSpan={9} style={{padding:48,textAlign:'center',color:T.ink}}>Loading contacts…</td></tr>
                ):sorted.length===0?(
                  <tr><td colSpan={9} style={{padding:48,textAlign:'center',color:T.ink}}>No contacts found</td></tr>
                ):sorted.map((ct,i)=>{
                  const AiBadge = ({children}:{children:React.ReactNode}) => (
                    <span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:3,background:'rgba(74,222,128,0.15)',color:'#22c55e',border:'1px solid rgba(74,222,128,0.3)',marginLeft:4,whiteSpace:'nowrap'}}>AI</span>
                  );
                  return (
                  <tr key={`${ct.contact_id}-${i}`} style={{borderBottom:`1px solid ${T.border}`}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <td style={{padding:'12px 14px',fontSize:14,fontWeight:600,color:T.ink,whiteSpace:'nowrap'}}>{ct.name||'—'}</td>
                    <td style={{padding:'12px 14px',fontSize:13,color:T.ink,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={ct.title}>{ct.title||'—'}</td>
                    <td style={{padding:'12px 14px',fontSize:13,color:T.ink,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={ct.organization}>{ct.organization||'—'}</td>
                    <td style={{padding:'12px 14px',fontSize:13,whiteSpace:'nowrap'}}>
                      {ct.email?<a href={`mailto:${ct.email}`} style={{color:T.accent,textDecoration:'none'}}>{ct.email}</a>:<span style={{color:T.faint}}>—</span>}
                    </td>
                    <td style={{padding:'12px 14px',fontSize:13,color:T.ink,whiteSpace:'nowrap'}}>{ct.phone||'—'}</td>
                    <td style={{padding:'12px 14px',fontSize:13,whiteSpace:'nowrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:0}}>
                        {ct.ai_email?<><a href={`mailto:${ct.ai_email}`} style={{color:'#22c55e',textDecoration:'none'}}>{ct.ai_email}</a><AiBadge>{null}</AiBadge></>:<span style={{color:T.faint}}>—</span>}
                      </div>
                    </td>
                    <td style={{padding:'12px 14px',fontSize:13,whiteSpace:'nowrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:0}}>
                        {ct.ai_phone?<><span style={{color:'#22c55e'}}>{ct.ai_phone}</span><AiBadge>{null}</AiBadge></>:<span style={{color:T.faint}}>—</span>}
                      </div>
                    </td>
                    <td style={{padding:'12px 14px',fontSize:12,color:T.ink,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={ct.ai_background}>
                      <div style={{display:'flex',alignItems:'center',gap:0}}>
                        {ct.ai_background?<><span style={{color:'#22c55e'}}>{ct.ai_background.substring(0,40)}</span><AiBadge>{null}</AiBadge></>:<span style={{color:T.faint}}>—</span>}
                      </div>
                    </td>
                    <td style={{padding:'12px 14px',fontSize:12,color:T.ink,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={ct.ai_technical_skills}>
                      <div style={{display:'flex',alignItems:'center',gap:0}}>
                        {ct.ai_technical_skills?<><span style={{color:'#22c55e'}}>{ct.ai_technical_skills.substring(0,40)}</span><AiBadge>{null}</AiBadge></>:<span style={{color:T.faint}}>—</span>}
                      </div>
                    </td>
                    <td style={{padding:'12px 14px'}}><span style={{fontSize:12,fontWeight:600,color:ROLE_COLOR[ct.role_type]||T.mute}}>{ct.role_type||'—'}</span></td>
                    <td style={{padding:'12px 14px'}}><span style={{fontSize:11,fontWeight:700,fontFamily:T.mono,padding:'2px 7px',borderRadius:4,background:T.accentDim,color:T.accent,border:'1px solid rgba(0,217,146,0.3)'}}>S{ct.stage}</span></td>
                    <td style={{padding:'12px 14px',fontSize:12,whiteSpace:'nowrap'}}><span style={{color: ct.doc_created_date && ct.doc_created_date!=='null' ? T.ink : T.faint, fontWeight: ct.doc_created_date && ct.doc_created_date!=='null' ? 600 : 400}}>{fmtDate(ct.doc_created_date)}</span></td>
                    <td style={{padding:'12px 14px',maxWidth:220}}>
                      <a href={`/CAStateIntel/stage${ct.stage}?project=${ct.project_number}&tab=overview`}
                        style={{fontSize:12,color:T.ink,textDecoration:'none',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                        title={`${ct.project_number} - ${ct.project_name}`}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.accent}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.ink}>
                        {ct.project_number} · {ct.project_name}
                      </a>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
