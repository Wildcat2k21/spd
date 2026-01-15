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
// body: FormData { file: Blob, roomId: string }
app.post('/screenshot', upload.single('file'), (req, res) => {
    const roomId = req.body.roomId;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!roomId || !rooms.roomExists(roomId)) {
        // Удаляем временный файл, если комната не найдена
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Room not found' });
    }

    // Получаем папку комнаты
    const roomPath = rooms.getRoomPath(roomId);
    const oldPath = req.file.path;

    const imgName = DEF_FILE_NAME; //req.fileId
    const newPath = path.join(roomPath, `${imgName}.jpg`);

    // Перемещаем файл в папку комнаты
    fs.renameSync(oldPath, newPath);

    res.json({ id: imgName, roomId });
});

// ------------------
app.get('/screen/:roomId/:filename', (req, res) => {
    const { roomId, filename } = req.params;

    const filePath = path.join(
        rooms.getRoomPath(roomId),
        filename
    );

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
    }

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
        console.clear();
        console.log(`Сервер запущен: ${PUBLIC_URL}`)
    }
);
