'use client';
import RvtNav from '@/components/castateintel/RvtNav';

export default function Page() {
  return (
    <div style={{minHeight:'100vh',background:'#0d0d0d',color:'#f0f0f0',fontFamily:'"Inter",system-ui,sans-serif',display:'flex',flexDirection:'column'}}>
      <RvtNav/>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,padding:'60px 32px'}}>
        <div style={{fontSize:72,lineHeight:1}}>📊</div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase',color:'#00d992',marginBottom:12}}>Coming Soon</div>
          <h1 style={{fontSize:36,fontWeight:800,letterSpacing:'-0.5px',margin:0,color:'#f0f0f0'}}>Contract Award Data</h1>
          <p style={{fontSize:16,color:'#aaaaaa',marginTop:12,lineHeight:1.6,maxWidth:480}}>This feature is under development and will be available soon.</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',padding:'12px 24px',borderRadius:12,background:'#161616',border:'1px solid #2a2a2a'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#00d992',animation:'pulse 2s infinite'}}/>
          <span style={{fontSize:13,color:'#cccccc'}}>In development</span>
        </div>
      </div>
    </div>
  );
}
