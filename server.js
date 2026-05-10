const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
    socket.on('join-lobby', (username) => {
        if (gameStarted) return socket.emit('error', 'Game already in progress');
        
        const newPlayer = { id: socket.id, name: username, isHost: players.length === 0 };
        players.push(newPlayer);
        
        io.emit('update-lobby', players);
    });

    socket.on('start-game', () => {
        const player = players.find(p => p.id === socket.id);
        if (player && player.isHost) {
            gameStarted = true;
            io.emit('game-phase', { phase: 'DRAWING', message: 'Draw a secret object!' });
        }
    });

    socket.on('submit-turn', (data) => {
        // Logic to rotate drawings/prompts goes here
        socket.broadcast.emit('new-task', { image: data.image, type: 'GUESS' });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (players.length === 0) gameStarted = false;
        io.emit('update-lobby', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on ${PORT}`));
