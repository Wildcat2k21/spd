import CameraScreenshotController from './screenshot.js';
import Logger from './logger.js';

const canvas = document.getElementById('rec-show');
const select = document.getElementById('rec-dev-select');
const btn = document.getElementById('rec-share');

const logger = new Logger("#txt-logs");
const camera = new CameraScreenshotController(canvas, logger);

// Очистка старого ID комнаты
localStorage.clear();

const api = `
    ${__CONFIG__.PROTOCOL}://
    ${__CONFIG__.SERVER_HOST}
    ${__CONFIG__.API_PREFIX ?
        '/' + __CONFIG__.API_PREFIX : ''
    }`.replace(/\s+/g, '').trim();

logger.addLine(`Используется: ${api}`);

// загрузка устройств
camera.initDevices().then(devices => {
    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || 'Камера';
        select.appendChild(opt);
    });
});

// выбор камеры
select.addEventListener('change', e => {
    if (e.target.value) {
        camera.start(e.target.value);
    }
});

// Вешаем события
const $roomLink = document.querySelector('#share-link');

function selectAllIfNotEmpty() {
    if (!$roomLink.value) return;

    // небольшой таймаут — важно для mobile (iOS / Android)
    setTimeout(() => {
        $roomLink.focus();
        $roomLink.select();
    }, 0);
}

$roomLink.addEventListener('click', selectAllIfNotEmpty);
$roomLink.addEventListener('touchend', selectAllIfNotEmpty);

let screenshotsIsRunning = false;
let screenshotsIsStopped = false;

async function screenshotLoop() {
    if (screenshotsIsStopped) return;
    if (screenshotsIsRunning) return;

    screenshotsIsRunning = true;
    console.log(screenshotsIsStopped, screenshotsIsRunning);

    try {
        const blob = await camera.makeScreenshot({
            quality: Number(__CONFIG__.SCR_QUALITY),
        });

        const roomId = localStorage.getItem('roomId');
        if (!roomId) {
            logger.addLine('Комната не создана');
            return;
        }

        const form = new FormData();
        form.append('file', blob, 'screenshot.jpg');
        form.append('roomId', roomId);

        const res = await fetch(`${api}/screenshot`, {
            method: 'POST',
            body: form
        });

        const json = await res.json();
        logger.addLine(
            `Скрин сохранён: ${json.id}, ${(blob.size / 1024).toFixed(1)} KB`
        );
    } catch (err) {
        logger.addLine(`Ошибка скрина: ${err.message}`);
    } finally {
        screenshotsIsRunning = false;
        setTimeout(screenshotLoop, __CONFIG__.SCR_INTERVAL ?? 1000);
    }
}

screenshotLoop();

// кнопка "создания комнаты"
btn.addEventListener('click', async ({ target }) => {

    screenshotsIsStopped = !screenshotsIsStopped;

    if(!screenshotsIsStopped) {
        target.textContent = "Остановить";

        // Не спамить комнатами
        if(!localStorage.getItem('roomId')){
            await createRoom();
        }
    }
    // Остановка скриншотов
    else{
        target.textContent = "Продолжить";
    }
});

async function createRoom(){
    const res = await fetch(`${api}/create-room`, { method: 'POST' });
    const { roomId } = await res.json();

    // Сохраняем ID комнаты
    localStorage.setItem('roomId', roomId);

    $roomLink.value =
        `${location.protocol}//${location.host}/preview.html?roomId=${roomId}`;

    logger.addLine(`Комната создана, ID: ${roomId}`);
}