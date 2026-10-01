// Netlify Scheduled Function: resumo de posts por push ("Fulano e Ciclano postaram — venha conferir!").
// Roda de hora em hora; a rota decide se já passou o intervalo escolhido pelo adm e respeita o horário de silêncio.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.log('Resumo ignorado: URL ou CRON_SECRET ausente');
    return;
  }
  const res = await fetch(`${base}/api/cron/digest`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log('Resumo', res.status, await res.text());
};

export const config = { schedule: '@hourly' };
