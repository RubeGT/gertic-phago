const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Allows connections from your Railway URL
});

app.use(express.static(path.join(__dirname, 'public')));

// Game State: Stores players and their sequence of drawings
let players = [];
let gameStarted = false;

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    socket.on('join-game', (username) => {
        players.push({ id: socket.id, name: username, currentTask: null });
        io.emit('update-players', players);
    });

    // When a player finishes a drawing
    socket.on('submit-drawing', (data) => {
        // Find the next player in the list to send the drawing to
        const currentIndex = players.findIndex(p => p.id === socket.id);
        const nextIndex = (currentIndex + 1) % players.length;
        const recipientId = players[nextIndex].id;

        // Send the drawing to the next person for 'guessing'
        io.to(recipientId).emit('new-task', {
            type: 'guess',
            image: data.image
        });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('update-players', players);
    });
});

// Railway uses the PORT environment variable
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
