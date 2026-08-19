const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

const envPath = envCandidates.find((p) => fs.existsSync(p));
if (!envPath) {
  console.error('Aucun fichier .env trouvé');
  process.exit(1);
}

const env = {};
for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const targetEmail = 'ahmed.jemel2639@gmail.com';

async function main() {
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(env.SMTP_PORT || 587);
  const secure = env.SMTP_SECURE !== undefined ? String(env.SMTP_SECURE).toLowerCase() === 'true' : port === 465;
  const user = env.SMTP_USER ? env.SMTP_USER.trim() : '';
  const pass = env.SMTP_PASSWORD ? env.SMTP_PASSWORD.replace(/\s+/g, '') : '';

  // Résolution explicite IPv4 pour éliminer à 100% tout ENETUNREACH IPv6 sous Windows
  let resolvedHost = host;
  if (host !== 'localhost' && !host.startsWith('127.')) {
    try {
      const lookup = await dns.lookup(host, { family: 4 });
      resolvedHost = lookup.address;
      console.log(`Hôte résolu IPv4: ${host} -> ${resolvedHost}`);
    } catch (e) {
      console.warn(`Impossible de résoudre l'IPv4 pour ${host}, utilisation directe.`);
    }
  }

  const transporter = nodemailer.createTransport({
    host: resolvedHost,
    port,
    secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { servername: host },
    auth: user && pass ? { user, pass } : undefined,
  });

  console.log('--- ENVOI DE 3 EMAILS SUCCESSIFS ---');
  for (let i = 1; i <= 3; i++) {
    const info = await transporter.sendMail({
      from: env.MAIL_FROM || user || 'VisioraAI Agile <no-reply@visiora.ai>',
      to: targetEmail,
      subject: `VisioraAI - Test SMTP IPv4 #${i}`,
      text: `Test de validation de connectivité SMTP IPv4 #${i} pour ${targetEmail}.`,
    });
    console.log(`Email #${i} envoyé avec succès: ${info.response}`);
  }
  console.log('--- TOUS LES EMAILS SONT ENVOYES SANS ERREUR ---');
}

main().catch((err) => {
  console.error('TEST_FAILED:', err);
  process.exit(1);
});
