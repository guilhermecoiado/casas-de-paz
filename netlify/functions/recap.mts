// Netlify Scheduled Function: fechamento da semana (resumo da semana que passou).
// 11:20 UTC = 8:20 em Brasília. A rota só envia no 1º dia de uma semana nova e uma vez por semana.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) { console.log('Fechamento ignorado: URL ou CRON_SECRET ausente'); return; }
  const res = await fetch(`${base}/api/cron/recap`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log('Fechamento', res.status, await res.text());
};

export const config = { schedule: '20 11 * * *' };
