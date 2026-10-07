'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode, RefreshCw } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { errMsg, supabase } from '@/lib/supabase';
import { shareImage } from '@/lib/image';
import { useConfirm, useToast } from './Providers';
import { Spinner } from './ui';

const qrText = (groupId: string, code: string) => `CASADEPAZ:${groupId}:${code}`;

/** Cartaz para imprimir (A4 em pé). */
export async function posterBlob(groupName: string, data: string, code: string): Promise<Blob> {
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1000))]);
  const W = 1240, H = 1754;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#FBF6EE'); bg.addColorStop(1, '#EFE0C6');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#C8553D'; ctx.fillRect(0, 0, W, 24); ctx.fillRect(0, H - 24, W, 24);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#C8553D';
  ctx.font = '900 40px Nunito, system-ui, sans-serif';
  ctx.fillText('CASA DE PAZ', W / 2, 150);
  ctx.fillStyle = '#2B2118';
  ctx.font = '700 96px Fraunces, Georgia, serif';
  ctx.fillText('Check-in', W / 2, 260);
  ctx.fillStyle = '#8A6F57';
  ctx.font = '700 40px Nunito, system-ui, sans-serif';
  ctx.fillText(groupName, W / 2, 322);
  // QR
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, data, { width: 780, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#2B2118', light: '#FFFFFF' } });
  const qx = (W - 860) / 2, qy = 390;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qx, qy, 860, 860);
  ctx.drawImage(qr, qx + 40, qy + 40, 780, 780);
  // código
  ctx.fillStyle = '#2B2118';
  ctx.font = '800 34px Nunito, system-ui, sans-serif';
  ctx.fillText('Sem câmera? Digite o código:', W / 2, 1340);
  ctx.font = '900 84px ui-monospace, Menlo, monospace';
  ctx.fillText(code.split('').join(' '), W / 2, 1440);
  ctx.fillStyle = '#6b5643';
  ctx.font = '700 34px Nunito, system-ui, sans-serif';
  ctx.fillText('Abra o app  →  toque no +  →  Check-in  →  escaneie', W / 2, 1540);
  ctx.fillStyle = '#C8553D';
  ctx.font = '800 36px Nunito, system-ui, sans-serif';
  ctx.fillText('🎁 Cada check-in libera um item surpresa!', W / 2, 1610);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar o cartaz'))), 'image/jpeg', 0.95));
}

export function AdminCheckinQR() {
  const { group, reload } = useGroup();
  const toast = useToast();
  const ask = useConfirm();
  const [code, setCode] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (rotate = false) => {
    const { data, error } = await supabase.rpc('admin_checkin_code', { p_group: group.id, p_rotate: rotate });
    if (error) return toast(errMsg(error), 'error');
    setCode(data as string);
    setImg(await QRCode.toDataURL(qrText(group.id, data as string), { width: 360, margin: 1, color: { dark: '#2B2118', light: '#FFFFFF' } }));
  }, [group.id, toast]);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    const { error } = await supabase.from('groups').update({ checkin_qr: !group.checkin_qr }).eq('id', group.id);
    if (error) return toast(errMsg(error), 'error');
    reload();
  };

  const rotate = async () => {
    if (!(await ask({ title: 'Gerar um QR novo?', message: 'O cartaz atual para de funcionar.\nVai precisar imprimir de novo.', confirmLabel: 'Gerar novo', danger: true }))) return;
    await load(true);
    toast('QR novo gerado. Imprima o cartaz de novo.');
  };

  const download = async () => {
    if (!code) return;
    setBusy(true);
    try {
      await shareImage(await posterBlob(group.name, qrText(group.id, code), code), 'checkin-casa-de-paz.jpg');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><QrCode size={20} className="text-terra" /> QR code do check-in</h2>
      <div className="flex items-start gap-3 rounded-2xl bg-cream p-3">
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">Exigir QR no check-in</p>
          <p className="text-sm leading-snug text-[#8A6F57]">Só faz check-in quem escanear o QR fixado no local. Cada check-in sorteia um item surpresa.</p>
        </div>
        <button
          role="switch" aria-checked={group.checkin_qr} aria-label="Exigir QR no check-in" onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${group.checkin_qr ? 'bg-olive' : 'bg-[#d9c8b2]'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${group.checkin_qr ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img} alt="QR code do check-in" className="h-full w-full" /> : <Spinner className="h-6 w-6 text-terra" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#a8927a]">Código (para digitar)</p>
          <p className="font-mono text-2xl font-extrabold tracking-[0.2em]">{code ?? '······'}</p>
          <p className="mt-1 text-xs leading-snug text-[#8A6F57]">É sempre o mesmo. Imprima e deixe fixado no local do encontro.</p>
        </div>
      </div>
      <button className="btn-primary w-full" onClick={download} disabled={!code || busy}>{busy ? <Spinner /> : <><Download size={18} /> Baixar cartaz para imprimir</>}</button>
      <button className="btn-soft w-full !min-h-[42px] !text-sm" onClick={rotate}><RefreshCw size={15} /> Gerar QR novo</button>
    </section>
  );
}
