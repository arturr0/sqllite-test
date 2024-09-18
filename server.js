// Import necessary packages
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const WebSocket = require('ws');

// Initialize Express app and WebSocket server
const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Create SQLite database (if not exists)
const db = new sqlite3.Database(':memory:'); // This creates an in-memory database for demo. For persistent data, replace ':memory:' with 'chat.db'.

// Create a table to store chat messages
db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Serve a simple homepage
app.get('/', (req, res) => {
    res.send('Chat server running...');
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');

    // Listen for incoming messages
    ws.on('message', (data) => {
        const parsedData = JSON.parse(data);
        const { user, message } = parsedData;

        // Insert message into the SQLite database
        db.run(`INSERT INTO messages (user, message) VALUES (?, ?)`, [user, message], (err) => {
            if (err) {
                console.error('Error inserting message:', err);
                ws.send(JSON.stringify({ error: 'Error storing message in database' }));
            } else {
                console.log('Message stored:', message);

                // Broadcast the message to all connected clients
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ user, message }));
                    }
                });
            }
        });
    });

    // Fetch the chat history when a new client connects
    db.all(`SELECT user, message, timestamp FROM messages ORDER BY id DESC LIMIT 10`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching chat history:', err);
            return;
        }

        // Send chat history to the new client
        rows.reverse().forEach((row) => {
            ws.send(JSON.stringify({ user: row.user, message: row.message, timestamp: row.timestamp }));
        });
    });

    // Handle WebSocket disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
