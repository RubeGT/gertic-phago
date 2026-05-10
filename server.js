const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (username) => {
        const roomId = crypto.randomBytes(3).toString('hex'); 
        rooms[roomId] = {
            players: [{ id: socket.id, name: username, isHost: true }],
            phase: 'LOBBY',
            album: []
        };
        socket.join(roomId);
        socket.emit('room-joined', { roomId, players: rooms[roomId].players });
    });

    socket.on('join-room', ({ roomId, username }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit('error-msg', 'Room not found');
        const newPlayer = { id: socket.id, name: username, isHost: false };
        room.players.push(newPlayer);
        socket.join(roomId);
        socket.emit('room-joined', { roomId, players: room.players });
        io.to(roomId).emit('update-players', room.players);
    });

    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (room && room.players[0].id === socket.id) {
            room.phase = 'PROMPT';
            io.to(roomId).emit('change-phase', { phase: 'PROMPT', msg: 'Write a secret prompt!' });
        }
    });

    socket.on('submit-data', ({ roomId, data, type }) => {
        const room = rooms[roomId];
        if(!room) return;
        const player = room.players.find(p => p.id === socket.id);
        room.album.push({ user: player.name, type, content: data });

        if (room.album.filter(a => a.type === type).length === room.players.length) {
            if (type === 'PROMPT') {
                room.players.forEach((p, i) => {
                    const next = room.players[(i + 1) % room.players.length];
                    const prompt = room.album.find(a => a.user === p.name).content;
                    io.to(next.id).emit('change-phase', { phase: 'DRAW', msg: `Draw: ${prompt}` });
                });
            } else {
                io.to(roomId).emit('change-phase', { phase: 'RESULTS', album: room.album });
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`Live on ${PORT}`));
