// Netlify Scheduled Function: dispara o lembrete do dia da Casa de Paz.
// 11:00 UTC = 08:00 em Brasília. A rota garante no máximo 1 lembrete por grupo por dia.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.log('Lembrete ignorado: URL ou CRON_SECRET ausente');
    return;
  }
  const res = await fetch(`${base}/api/cron/reminder`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log('Lembrete', res.status, await res.text());
};

export const config = { schedule: '0 11 * * *' };
