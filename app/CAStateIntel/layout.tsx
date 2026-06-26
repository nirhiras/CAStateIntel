import RvtNav from '@/components/castateintel/RvtNav';

export default function CAStateIntelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RvtNav />
      <div style={{ paddingTop: 83 }}>
        {children}
      </div>
    </>
  );
}
