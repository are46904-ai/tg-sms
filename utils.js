// ==== file: utils.js ====
import os from 'os';

export const Utils = {
    formatTime: (ms) => {
        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
        return `${h}ч ${m % 60}м ${s % 60}с`;
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
        } else if (ua.includes("iPhone")) res.model = "Apple iPhone";
        else if (ua.includes("Windows")) res.model = "Windows PC";
        if (ua.includes("Chrome")) res.browser = "Chrome";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) res.browser = "Safari";
        else if (ua.includes("Firefox")) res.browser = "Firefox";
        else if (ua.includes("Telegram")) res.browser = "Telegram";
        return res;
    },
    getIpInfo: async (ip) => {
        try {
            const r = await fetch(`http://ip-api.com/json/${ip.split(',')[0]}?fields=country,city,isp,proxy,hosting`);
            const d = await r.json();
            if (d.status === 'success') return { country: d.country, city: d.city, isp: d.isp, isVpn: d.proxy || d.hosting };
        } catch (e) {}
        return null;
    },
    getSystemStats: () => {
        return {
            uptime: Utils.formatTime(os.uptime() * 1000),
            platform: os.platform(),
            cpus: os.cpus().length
        };
    }
};
