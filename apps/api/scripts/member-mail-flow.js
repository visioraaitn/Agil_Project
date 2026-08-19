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

const TEST_EMAIL = `visiora.ai.tn+membertest${Date.now()}@gmail.com`;

async function request(method, path, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('http://localhost:3000/api/v1' + path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  console.log('STEP 1: login admin');
  const login = await request('POST', '/auth/login', { email: 'admin@visiora.ai', password: 'Visiora2026!' });
  console.log('LOGIN_STATUS', login.status);
  if (login.status !== 200) {
    console.log(JSON.stringify(login.data));
    process.exit(1);
  }
  const token = login.data.accessToken;

  console.log('STEP 2: create target user');
  const createUser = await request('POST', '/users', {
    email: TEST_EMAIL,
    name: 'Member Flow Test',
    jobTitle: 'QA',
    globalRole: 'MEMBER',
    password: 'StrongPassword123!'
  }, token);
  console.log('CREATE_USER_STATUS', createUser.status);
  console.log(JSON.stringify(createUser.data));
  if (createUser.status !== 201) process.exit(1);

  console.log('STEP 3: add user to project');
  const addMember = await request('POST', '/projects/VIS/members', {
    userId: createUser.data.id,
    role: 'DEVELOPER',
    capacity: 8,
  }, token);
  console.log('ADD_MEMBER_STATUS', addMember.status);
  console.log(JSON.stringify(addMember.data));
  if (addMember.status !== 201 && addMember.status !== 200) process.exit(1);

  console.log('STEP 4: direct app-level SMTP send to same mailbox');
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
  const info = await transporter.sendMail({
    from: env.MAIL_FROM || user || 'VisioraAI Agile <no-reply@visiora.ai>',
    to: user || TEST_EMAIL,
    subject: 'VisioraAI member flow verification',
    text: `Test end-to-end member assignment triggered. Recipient: ${TEST_EMAIL}`,
  });
  console.log('SMTP_RESPONSE', info.response);

  console.log('FLOW_OK');
})();
