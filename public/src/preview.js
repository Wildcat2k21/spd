// preview.js
import Logger from './logger.js';

const logger = new Logger('#txt-logs');

const api = `
    ${__CONFIG__.PROTOCOL}://
    ${__CONFIG__.SERVER_HOST}
    ${__CONFIG__.API_PREFIX ?
        '/' + __CONFIG__.API_PREFIX : ''
    }`.replace(/\s+/g, '').trim();

// --- Получаем query параметры ---
function getQueryParams() {
    const params = {};
    location.search.substring(1).split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
}

const params = getQueryParams();
const roomId = params.roomId;

if (!roomId) {
    logger.addLine('Не указан roomId в query параметрах');
    throw new Error('Не указан roomId в query параметрах');
}

// --- Canvas ---
const canvas = document.getElementById('img-show');
const ctx = canvas.getContext('2d');

// --- Функция pull ---
async function pullImage(filename = 'main.jpg') {
    try {
        const url = `${api}/screen/${roomId}/${filename}`;
        const res = await fetch(url);

        if (!res.ok) {
            logger.addLine(`Ошибка запроса: ${res.status} ${res.statusText}`);
            throw new Error(`Ошибка запроса: ${res.status} ${res.statusText}`);
        }

        const blob = await res.blob();
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Масштабируем и центрируем
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.drawImage(img, x, y, w, h);

            logger.addLine(`Картинка "${filename}" успешно загружена`);
        };
        img.src = URL.createObjectURL(blob);
    } catch (err) {
        logger.addLine(`Ошибка при pull: ${err.message}`);
        throw err;
    }
}

// --- Авто pull / раз в секунду ---
setInterval(() => {
    pullImage('main.jpg');
}, __CONFIG__.INTERVAL ?? 1000);

// Первый вызов сразу
pullImage('main.jpg');
