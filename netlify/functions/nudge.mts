// Netlify Scheduled Function: 20h (Brasília) lembra quem ainda não postou hoje.
// 23:02 UTC = 20:02 em Brasília. A rota garante no máximo 1 por grupo por dia.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) { console.log('Lembrete das 20h ignorado: URL ou CRON_SECRET ausente'); return; }
  const res = await fetch(`${base}/api/cron/nudge`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log('Lembrete 20h', res.status, await res.text());
};

export const config = { schedule: '2 23 * * *' };
