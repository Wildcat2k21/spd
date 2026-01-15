import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export class RoomManager {
    constructor(baseDir = './screenshots') {
        this.baseDir = baseDir;
        if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir);
    }

    // Создать новую комнату и вернуть ID
    createRoom() {
        const roomId = nanoid();
        const roomPath = path.join(this.baseDir, roomId);
        fs.mkdirSync(roomPath);
        return roomId;
    }

    // Получить путь к папке комнаты
    getRoomPath(roomId) {
        return path.join(this.baseDir, roomId);
    }

    // Получить список файлов в комнате
    listFiles(roomId) {
        const roomPath = this.getRoomPath(roomId);
        if (!fs.existsSync(roomPath)) return [];
        return fs.readdirSync(roomPath);
    }

    // Удалить файл
    deleteFile(roomId, filename) {
        const filePath = path.join(this.getRoomPath(roomId), filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Переименовать файл
    renameFile(roomId, oldName, newName) {
        const oldPath = path.join(this.getRoomPath(roomId), oldName);
        const newPath = path.join(this.getRoomPath(roomId), newName);
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }

    // Проверить, существует ли комната
    roomExists(roomId) {
        return fs.existsSync(this.getRoomPath(roomId));
    }
}
