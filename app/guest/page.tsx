import MindMapCanvas from '@/components/MindMapCanvas';
import Navbar from '@/components/Navbar';

export default function GuestPage() {
  return (
    <>
      <Navbar mode="landing" />
      <main className="w-screen h-screen overflow-hidden bg-slate-50 pt-14">
        <MindMapCanvas
          mapId="guest"
          accessRole="owner"
          token={null}
          tokenColumn={null}
          guestMode
        />
      </main>
    </>
  );
}
