'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Download, Printer, RefreshCw, Layers, ShieldAlert } from 'lucide-react';
import { Box, Location } from '@/lib/database.types';
import QRCode from 'qrcode';

import { useAuth } from '@/lib/supabase/AuthProvider';

export default function BoxDetailsPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const boxId = params.id as string;

  const [box, setBox] = useState<Box | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDetails = () => {
      const list = supabase.from('boxes').select().eq('id', boxId).data || [];
      if (list.length > 0) {
        const b = list[0] as Box;
        setBox(b);

        // Generate QR code base64 URL
        QRCode.toDataURL(b.qr_code_data, { width: 200, margin: 1 }, (err, url) => {
          if (!err) setQrUrl(url);
        });
      }
      const locs = supabase.from('locations').select().data || [];
      setLocations(locs as Location[]);
    };

    fetchDetails();
  }, [boxId]);

  const handleRegenerateQr = () => {
    if (!box) return;
    const newCode = `BX-${Math.floor(Math.random() * 90000 + 10000)}`;
    const updated = { ...box, qr_code_data: newCode, box_code: newCode };
    supabase.from('boxes').update(updated).eq('id', box.id);
    setBox(updated);
    
    QRCode.toDataURL(newCode, { width: 200, margin: 1 }, (err, url) => {
      if (!err) setQrUrl(url);
    });

    // Add log
    supabase.from('audit_logs').insert({
      id: `log-${Date.now()}`,
      user_email: user?.email || 'manager@demo.com',
      action: 'REGENERATE_QR',
      object_type: 'BOX',
      object_id: box.id,
      previous_state: { qr: box.qr_code_data },
      new_state: { qr: newCode },
      timestamp: new Date().toISOString()
    });
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Print Label - ${box?.box_code}</title>
            <style>
              body { font-family: monospace; text-align: center; padding: 40px; color: #000; }
              .label-card { border: 2px solid #000; padding: 20px; display: inline-block; }
              h1 { margin: 10px 0; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="label-card">
              ${content}
            </div>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  if (!box) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <p>Loading box packet registry...</p>
      </div>
    );
  }

  const srcName = locations.find(l => l.id === box.current_location_id)?.name || 'Sorting Inbound';
  const destName = locations.find(l => l.id === box.destination_location_id)?.name || 'Outbound Dock';

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/boxes')}
              className="p-2.5 rounded-xl border border-slate-900 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <span className="text-[10px] font-black uppercase text-blue-500 font-mono tracking-widest">ID Card Labels</span>
              <h1 className="text-2xl font-bold text-slate-100">{box.box_code} Detail Roster</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Box details and settings panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Operational Identity</h3>
                
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium">Product Description</span>
                    <p className="text-slate-200 font-bold text-sm">{box.product_name}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium">Category Group</span>
                    <p className="text-slate-200 font-bold text-sm">{box.category}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium">Net Weight</span>
                    <p className="text-slate-200 font-mono font-bold text-sm">{box.weight} KG</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium">Urgency Level</span>
                    <p className="mt-1">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        box.priority === 'URGENT' ? 'bg-red-950 text-red-400' : 'bg-slate-900 text-slate-400'
                      }`}>{box.priority}</span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-6 grid grid-cols-2 gap-6 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Source Location</span>
                    <p className="text-slate-200 font-bold">{srcName}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Destination Target</span>
                    <p className="text-slate-200 font-bold">{destName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Generated QR label panel card */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 flex flex-col items-center justify-between text-center space-y-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Verified Scan Identity</span>
              
              {/* printable area wrapper */}
              <div ref={printRef} className="bg-white p-4 rounded-xl border border-slate-200">
                {qrUrl ? (
                  <img src={qrUrl} alt="Payload QR Code" className="h-44 w-44 object-contain mx-auto" />
                ) : (
                  <div className="h-44 w-44 bg-slate-100 flex items-center justify-center text-slate-400">QR Loading...</div>
                )}
                <div className="mt-2 text-slate-950 font-mono text-xs font-black">
                  <h3>{box.box_code}</h3>
                  <p className="text-[10px] font-medium max-w-[160px] truncate mx-auto">{box.product_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 w-full">
                <button
                  onClick={handlePrint}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 text-[10px] font-bold"
                >
                  <Printer className="h-4 w-4" />
                  Print Label
                </button>
                <a
                  href={qrUrl}
                  download={`QR-${box.box_code}.png`}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 text-[10px] font-bold"
                >
                  <Download className="h-4 w-4" />
                  Save Image
                </a>
                <button
                  onClick={handleRegenerateQr}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 text-[10px] font-bold"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regen Code
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
