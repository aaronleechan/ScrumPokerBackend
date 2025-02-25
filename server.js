const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, roomId, user, vote, title } = data;

        if (type === 'create') {
            const newRoomId = uuidv4();
            rooms[newRoomId] = {
                creator: user,
                title: title || 'Untitled',
                users: { [user]: true },
                votes: {},
                revealed: false
            };
            ws.send(JSON.stringify({ type: 'roomCreated', roomId: newRoomId, title: rooms[newRoomId].title }));
        } else if (type === 'join') {
            if (rooms[roomId]) {
                rooms[roomId].users[user] = true;
                ws.send(JSON.stringify({
                    type: 'joined',
                    roomId,
                    title: rooms[roomId].title,
                    votes: rooms[roomId].votes,
                    revealed: rooms[roomId].revealed
                }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            }
        } else if (type === 'vote' && rooms[roomId]) {
            rooms[roomId].votes[user] = vote;
            broadcastUpdate(roomId);
        } else if (type === 'updateTitle' && rooms[roomId] && rooms[roomId].creator === user) {
            rooms[roomId].title = title;
            broadcastUpdate(roomId);
        } else if (type === 'flip' && rooms[roomId] && rooms[roomId].creator === user) {
            rooms[roomId].revealed = !rooms[roomId].revealed;
            broadcastUpdate(roomId);
        }else if (type === 'resetVotes' && rooms[roomId] && rooms[roomId].creator === user) {
            rooms[roomId].votes = {};
            rooms[roomId].revealed = false; // Reset reveal state too
            broadcastUpdate(roomId);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function broadcastUpdate(roomId) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'update',
                roomId,
                title: rooms[roomId].title,
                votes: rooms[roomId].votes,
                revealed: rooms[roomId].revealed
            }));
        }
    });
}

app.get('/', (req, res) => {
    res.send('Scrum Poker Backend');
});

server.listen(process.env.PORT || 8080, '0.0.0.0', () => {
    console.log(`Server running on port ${process.env.PORT || 8080}`);
});
