const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5001;
const FILE_PATH = path.join(__dirname, 'attendance.json');

app.use(cors());
app.use(express.json());

// Initialize file if not exists
if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2));
}

// Get all attendance records
app.get('/api/attendance', (req, res) => {
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save or Update punch data
// Logic: simplified for this use case - we expect the client to send the FULL history or new record?
// Better: Client sends a new record to APPEND, or an update.
// For simplicity given the Context structure: allow saving the entire history or single record.
// Let's implement APPEND/UPDATE based on ID.
app.post('/api/attendance', (req, res) => {
    try {
        const newRecord = req.body;
        let history = [];

        if (fs.existsSync(FILE_PATH)) {
            const fileData = fs.readFileSync(FILE_PATH, 'utf8');
            history = JSON.parse(fileData);
        }

        // Check if record exists (update) or is new (push)
        const index = history.findIndex(r => r.id === newRecord.id);

        if (index !== -1) {
            history[index] = newRecord;
        } else {
            history.unshift(newRecord); // Add to top
        }

        fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Endpoint to overwrite full history (useful for initial sync/resets if needed, or if modifying Context logic)
app.post('/api/attendance/sync', (req, res) => {
    try {
        const fullHistory = req.body;
        fs.writeFileSync(FILE_PATH, JSON.stringify(fullHistory, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to sync data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
