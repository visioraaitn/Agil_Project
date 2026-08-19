const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];

let envPath = envCandidates.find((p) => fs.existsSync(p));
if (!envPath) {
  console.error('Aucun fichier .env trouvé dans les emplacements standard.');
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

const port = Number(env.SMTP_PORT || 587);
const secure = env.SMTP_SECURE !== undefined ? String(env.SMTP_SECURE).toLowerCase() === 'true' : port === 465;
const user = env.SMTP_USER ? env.SMTP_USER.trim() : '';
const pass = env.SMTP_PASSWORD ? env.SMTP_PASSWORD.replace(/\s+/g, '') : '';

const transportOptions = {
  host: env.SMTP_HOST || 'localhost',
  port,
  secure,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
};

if (user && pass) {
  transportOptions.auth = { user, pass };
}

const transporter = nodemailer.createTransport(transportOptions);

transporter
  .verify()
  .then(() => {
    console.log('SMTP_OK');
  })
  .catch((err) => {
    console.log('SMTP_FAIL');
    console.log(String(err && (err.code || err.name || 'UNKNOWN')));
    console.log(String(err && (err.response || err.message || String(err))).slice(0, 800));
    process.exit(1);
  });
