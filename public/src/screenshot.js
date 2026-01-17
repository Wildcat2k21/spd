export default class CameraScreenshotController {
    constructor(canvas, logger) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.video = document.createElement('video');
        this.video.playsInline = true;
        this.video.muted = true;
        this.stream = null;

        this.logger = logger;
    }

    async initDevices() {
        await navigator.mediaDevices.getUserMedia({ video: true });

        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'videoinput');
    }

    async start(deviceId) {
        this.stop();

        this.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: { exact: deviceId },
                width: this.canvas.width,
                height: this.canvas.height
            }
        });

        this.video.srcObject = this.stream;
        await this.video.play();
    }

    async makeScreenshot({
    quality = 0.8,
    mode = 'cover',
    deviceId
    } = {}) {
        try {
            // 1. Открываем камеру
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: this.canvas.width,
                    height: this.canvas.height
                }
            });

            this.video.srcObject = this.stream;
            await this.video.play();

            // 2. Ждём реальный кадр (ВАЖНО для Android)
            await new Promise(resolve => {
                if (this.video.videoWidth) return resolve();
                this.video.onloadedmetadata = () => resolve();
            });

            // 3. Рисуем кадр
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            drawImageCover(this.ctx, this.video, this.canvas, mode);

            // 4. Конвертируем в Blob
            const blob = await new Promise(resolve =>
                this.canvas.toBlob(resolve, 'image/jpeg', quality)
            );

            return blob;
        } finally {
            // 5. ВСЕГДА выключаем камеру
            this.stop();
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }
}

function drawImageCover(ctx, img, canvas, mode = 'cover') {
    const imgW = img.videoWidth || img.width;
    const imgH = img.videoHeight || img.height;

    const canvasW = canvas.width;
    const canvasH = canvas.height;

    const scale =
        mode === 'cover'
            ? Math.max(canvasW / imgW, canvasH / imgH)
            : Math.min(canvasW / imgW, canvasH / imgH);

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const offsetX = (canvasW - drawW) / 2;
    const offsetY = (canvasH - drawH) / 2;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}
