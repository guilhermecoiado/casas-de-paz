// Gera o par de chaves VAPID para as notificações. Uso: npm run vapid
import webpush from 'web-push';
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('\nCopie para as variáveis de ambiente da Vercel:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('\nGuarde a chave privada em segredo. Se trocar as chaves, todos precisam ativar as notificações de novo.\n');
