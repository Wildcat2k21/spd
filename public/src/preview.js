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

// --- Polling state ---
let lastETag = null;                  // хранит текущую версию (например: "abc.jpg")
let isFetching = false;
const baseInterval = Number(__CONFIG__.INTERVAL ?? 1000);
let consecutive304 = 0;               // для backoff на 304
const maxBackoffMultiplier = 15;      // ограничение backoff (baseInterval * 16)

let stopped = true;

// --- Функция отрисовки blob в canvas ---
function drawBlobToCanvas(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (canvas.width - w) / 2;
                const y = (canvas.height - h) / 2;
                ctx.drawImage(img, x, y, w, h);
                URL.revokeObjectURL(img.src);
                resolve();
            } catch (e) {
                URL.revokeObjectURL(img.src);
                reject(e);
            }
        };
        img.onerror = err => {
            URL.revokeObjectURL(img.src);
            reject(err);
        };
        img.src = URL.createObjectURL(blob);
    });
}

// --- Основной pull с поддержкой If-None-Match/ETag ---
async function pullOnce() {
    if (isFetching || stopped) return { status: 'skipped' };
    isFetching = true;

    try {
        const url = `${api}/screen/${roomId}`;
        const headers = {};
        if (lastETag) headers['If-None-Match'] = lastETag;

        const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });

        if (res.status === 304) {
            // картинка не изменилась
            consecutive304++;
            logger.addLine(`304 Not Modified (ETag ${lastETag}), backoff x${Math.min(2 ** consecutive304, maxBackoffMultiplier)}`);
            return { status: 304 };
        }

        if (!res.ok) {
            // 4xx/5xx — логируем, не увеличиваем 304-backoff
            logger.addLine(`Ошибка запроса: ${res.status} ${res.statusText}`);
            return { status: 'error', code: res.status };
        }

        // успешный ответ с картинкой
        const newETag = res.headers.get('ETag');
        const blob = await res.blob();

        await drawBlobToCanvas(blob);

        // обновляем ETag и сбрасываем backoff
        if (newETag) {
            logger.addLine(`Картинка обновлена, ETag: ${newETag}, size: ${(blob.size/1024).toFixed(1)} KB`);
            lastETag = newETag;
        } else {
            logger.addLine(`Картинка обновлена (ETag отсутствует), size: ${(blob.size/1024).toFixed(1)} KB`);
            lastETag = null;
        }
        consecutive304 = 0;
        return { status: 200 };
    } catch (err) {
        // сетевые/прочие ошибки — логируем и позволяем реке попробовать снова через базовый интервал
        logger.addLine(`Ошибка при pull: ${err.message}`);
        return { status: 'exception', error: err };
    } finally {
        isFetching = false;
    }
}

// --- Self-scheduling polling loop с backoff на 304 ---
async function pollLoop() {
    if (stopped) return;

    const result = await pullOnce();

    // Рассчитываем задержку до следующего запроса
    let delay = baseInterval;

    if (result.status === 304) {
        // экспоненциальный backoff, ограниченный
        const mul = Math.min(2 ** consecutive304, maxBackoffMultiplier);
        delay = baseInterval * mul;
    } else if (result.status === 'exception') {
        // при исключениях — небольшая пауза, но не увеличиваем backoff слишком сильно
        delay = Math.max(baseInterval, 1000);
    } else {
        // успех или другие — базовый интервал
        delay = baseInterval;
    }

    setTimeout(pollLoop, delay);
}

// --- Старт / стоп управления ---
function startPolling() {

    console.log(123);

    if (!stopped) return; //Прерывает

    console.log(333);

    stopped = false;
    consecutive304 = 0;
    pollLoop();
}

function stopPolling() {
    stopped = true;
}

// --- Инициализация: первый запрос сразу, затем loop ---
startPolling();

// Экспортируем управление если нужно в других модулях
export { startPolling, stopPolling, pullOnce };
