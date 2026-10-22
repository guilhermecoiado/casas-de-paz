'use client';

/** Dentro da barriga da baleia: tela escura que respira, costelas, bolhas e o contador até ser cuspido. */
export function WhaleBelly({ left }: { left: number }) {
  const end = left <= 3;
  return (
    <div className="fixed inset-0 z-[45] flex items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 55%, #C2416A 0%, #7A1F3D 45%, #2A0A18 100%)', touchAction: 'none' }}>
      <style>{'@keyframes cdp-breath{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@keyframes cdp-bub{from{transform:translateY(0);opacity:.9}to{transform:translateY(-110vh);opacity:0}}@keyframes cdp-swim{from{transform:translateX(-20vw)}to{transform:translateX(120vw)}}'}</style>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 90" preserveAspectRatio="none" style={{ animation: 'cdp-breath 2.6s ease-in-out infinite' }}>
        {[14, 32, 50, 68, 86, 104, 122, 140].map((x) => (
          <g key={x} fill="none" stroke="rgba(255,190,205,.28)" strokeWidth="3" strokeLinecap="round">
            <path d={`M${x} 2 Q${x + 9} 20 ${x} 36`} /><path d={`M${x} 88 Q${x + 9} 70 ${x} 54`} />
          </g>
        ))}
      </svg>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="absolute rounded-full border-2 border-white/60" style={{ left: `${(i * 37) % 95}%`, bottom: '-8vh', width: `${10 + (i % 4) * 8}px`, height: `${10 + (i % 4) * 8}px`, animation: `cdp-bub ${3 + (i % 3)}s linear ${i * 0.4}s infinite` }} />
      ))}
      <span className="absolute top-[14%] text-4xl" style={{ animation: 'cdp-swim 7s linear infinite' }}>🐟</span>
      <div className="relative flex flex-col items-center gap-[2vh] text-center">
        <p className="whitespace-nowrap font-display text-[min(6vw,9vh)] font-extrabold text-white">Você foi engolido pela baleia! 🐳</p>
        <div className={`flex h-[min(24vw,40vh)] w-[min(24vw,40vh)] items-center justify-center rounded-full border-[6px] ${end ? 'border-[#F3C64A] bg-[#F3C64A]/20' : 'border-white/70 bg-black/20'}`} style={end ? { animation: 'cdp-shake .35s linear infinite' } : undefined}>
          <span className={`font-display text-[min(13vw,22vh)] font-extrabold leading-none ${end ? 'text-[#F3C64A]' : 'text-white'}`}>{left}</span>
        </div>
        <p className="whitespace-nowrap text-[min(2.8vw,4.8vh)] font-extrabold text-white/85">{end ? 'Lá vem a cuspida! Segura firme 💦' : `Ela te cospe em ${left}s · você perde 10% dos pontos`}</p>
      </div>
    </div>
  );
}

