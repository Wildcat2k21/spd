import express from 'express';
import multer from 'multer';
import path from 'path';
import https from 'https'
import { nanoid } from 'nanoid';
import { RoomManager } from './modules/RoomManager.js'; // импортируем класс
import fs from 'fs';
import 'dotenv/config';

const app = express();
const SERVER_PORT = process.env.SERVER_PORT ?? 3000;
const SERVER_ADDR = process.env.SERVER_ADDR;
const PROTOCOL = process.env.PROTOCOL;
const PUBLIC_URL = `${PROTOCOL}://${SERVER_ADDR}:${SERVER_PORT}`;
const DEF_FILE_NAME = process.env.DEF_FILENAME ?? 'main';

// ------------------
// HTTPS
const httpsOptions = {
    key: fs.readFileSync('./cert/key.pem'),
    cert: fs.readFileSync('./cert/cert.pem'),
};

// ------------------
// RoomManager
const rooms = new RoomManager('./screenshots');

// ------------------
// Multer (для загрузки скриншотов)
// Пока сохраняем временно в base папку, позже можно в папку комнаты
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, rooms.baseDir); // потом заменим на rooms.getRoomPath(roomId)
    },
    filename: (req, file, cb) => {
        const id = nanoid();
        cb(null, `${id}.jpg`);
        req.fileId = id;
    }
});
const upload = multer({ storage });

// ------------------
// Статика
app.use(express.static('./public'));

// ------------------
// POST /create-room
// Создаёт новую комнату и возвращает её ID
app.post('/create-room', (req, res) => {
    const roomId = rooms.createRoom();
    res.json({ roomId });
});

// POST /screenshot
// body: FormData { file: Blob }
app.post('/screenshot', upload.single('file'), (req, res) => {
    const roomId = req.body.roomId;

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!roomId || !rooms.roomExists(roomId)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Room not found' });
    }

    const roomPath = rooms.getRoomPath(roomId);
    const tempPath = req.file.path;

    // 🟢 1. Сохраняем новый файл СРАЗУ
    const imgName = nanoid();
    const newPath = path.join(roomPath, `${imgName}.jpg`);

    fs.renameSync(tempPath, newPath);

    // 🟡 2. Удаляем все остальные файлы
    const files = fs.readdirSync(roomPath);
    for (const file of files) {
        if (file !== `${imgName}.jpg`) {
            try {
                fs.unlinkSync(path.join(roomPath, file));
            } catch (e) {
                // файл могли удалить параллельно — это ок
            }
        }
    }

    res.json({ id: imgName, roomId });
});


// ------------------
/// GET /screen/:roomId
app.get('/screen/:roomId', (req, res) => {
    const { roomId } = req.params;

    if (!rooms.roomExists(roomId)) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const roomPath = rooms.getRoomPath(roomId);
    const files = fs.readdirSync(roomPath);

    if (!files.length) {
        return res.status(404).json({ error: 'No screenshot yet' });
    }

    // В комнате всегда один файл
    const filename = files[0];
    const filePath = path.join(roomPath, filename);

    // Используем имя файла как версию
    const currentETag = `"${filename}"`;
    const clientETag = req.headers['if-none-match'];

    // Если клиент уже имеет эту версию — ничего не шлём
    if (clientETag === currentETag) {
        return res.status(304).end();
    }

    // Иначе — отдаём новую картинку
    res.setHeader('ETag', currentETag);
    res.setHeader('Cache-Control', 'no-cache'); // важно для браузеров

    res.sendFile(path.resolve(filePath));
});


// ------------------
// 404
app.use((req, res) => res.status(404).send('Not Found'));

// ------------------
https.createServer(httpsOptions, app).listen(
    SERVER_PORT,
    '0.0.0.0', 
    () => {
        // console.clear();
        console.log(`Сервер запущен: ${PUBLIC_URL}`)
    }
);
