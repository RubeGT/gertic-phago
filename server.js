const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Install this: npm install uuid

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

// Game Database
const rooms = {};

io.on('connection', (socket) => {
    // 1. CREATE ROOM
    socket.on('create-room', (username) => {
        const roomId = uuidv4().substring(0, 8); // Short unique ID
        rooms[roomId] = {
            players: [{ id: socket.id, name: username, isHost: true, sequence: [] }],
            phase: 'LOBBY',
            round: 0
        };
        socket.join(roomId);
        socket.emit('room-created', roomId);
        io.to(roomId).emit('update-players', rooms[roomId].players);
    });

    // 2. JOIN ROOM
    socket.on('join-room', ({ roomId, username }) => {
        if (!rooms[roomId]) return socket.emit('error-msg', 'Room not found');
        if (rooms[roomId].phase !== 'LOBBY') return socket.emit('error-msg', 'Game already started');

        const newPlayer = { id: socket.id, name: username, isHost: false, sequence: [] };
        rooms[roomId].players.push(newPlayer);
        socket.join(roomId);
        io.to(roomId).emit('update-players', rooms[roomId].players);
    });

    // 3. START GAME
    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (room && room.players[0].id === socket.id) {
            room.phase = 'PROMPT';
            io.to(roomId).emit('change-phase', { phase: 'PROMPT', msg: 'Write a secret prompt!' });
        }
    });

    // 4. HANDLE SUBMISSIONS (Prompt -> Drawing -> Guessing)
    socket.on('submit-data', ({ roomId, data, type }) => {
        const room = rooms[roomId];
        const player = room.players.find(p => p.id === socket.id);
        player.lastSubmission = { type, content: data };

        // Check if everyone submitted
        const allSubmitted = room.players.every(p => p.lastSubmission);
        if (allSubmitted) {
            // Logic to shuffle tasks to the next person
            advanceGame(roomId);
        }
    });
});

function advanceGame(roomId) {
    const room = rooms[roomId];
    room.round++;
    
    // Simplified logic: Tell everyone to draw based on the prompt received
    room.players.forEach((player, index) => {
        const nextIdx = (index + 1) % room.players.length;
        const targetPlayer = room.players[nextIdx];
        const prevContent = player.lastSubmission.content;

        io.to(targetPlayer.id).emit('change-phase', {
            phase: 'DRAW',
            msg: `Draw this: ${prevContent}`,
            targetData: prevContent
        });
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
