const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto'); // Built-in, won't crash

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    transports: ['websocket', 'polling'] // Better compatibility for Railway
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (username) => {
        // Generates a random 6-character room ID
        const roomId = crypto.randomBytes(3).toString('hex'); 
        rooms[roomId] = {
            players: [{ id: socket.id, name: username, isHost: true, lastSubmission: null }],
            phase: 'LOBBY'
        };
        socket.join(roomId);
        socket.emit('room-created', roomId);
        io.to(roomId).emit('update-players', rooms[roomId].players);
    });

    socket.on('join-room', ({ roomId, username }) => {
        if (!rooms[roomId]) return socket.emit('error-msg', 'Room not found');
        const newPlayer = { id: socket.id, name: username, isHost: false, lastSubmission: null };
        rooms[roomId].players.push(newPlayer);
        socket.join(roomId);
        io.to(roomId).emit('update-players', rooms[roomId].players);
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
        if(player) player.lastSubmission = { type, content: data };

        if (room.players.every(p => p.lastSubmission)) {
            advanceGame(roomId);
        }
    });

    socket.on('disconnect', () => {
        // Clean up logic could go here
    });
});

function advanceGame(roomId) {
    const room = rooms[roomId];
    room.players.forEach((player, index) => {
        const nextIdx = (index + 1) % room.players.length;
        const targetPlayer = room.players[nextIdx];
        const content = player.lastSubmission.content;

        io.to(targetPlayer.id).emit('change-phase', {
            phase: 'DRAW',
            msg: `Draw this: ${content}`
        });
    });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
