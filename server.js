const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVER_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing in .env file");
} else {
    mongoose.connect(MONGODB_URI).then(() => console.log("✅ Connected to MongoDB"))
        .catch(err => console.error("❌ MongoDB connection error:", err.message));
}

// Schema (Must match Vercel function)
const recordSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    date: String,
    day: String,
    punchIn: String,
    punchOut: String,
    duration: String,
    status: String,
    timestamp: String
});

const Record = mongoose.model('Record', recordSchema);

// In-memory fallback
let inMemoryHistory = [];

// Routes
app.get('/api/attendance', async (req, res) => {
    if (mongoose.connection.readyState === 1) {
        try {
            const records = await Record.find({}).sort({ id: -1 });
            res.json(records);
        } catch (err) {
            res.status(500).json({ error: 'Database read failed' });
        }
    } else {
        console.warn("⚠️ Using in-memory storage (Database not connected)");
        res.json(inMemoryHistory);
    }
});

app.post('/api/attendance', async (req, res) => {
    const newRecord = req.body;

    if (mongoose.connection.readyState === 1) {
        try {
            const existing = await Record.findOne({ id: newRecord.id });
            if (existing) {
                await Record.updateOne({ id: newRecord.id }, newRecord);
            } else {
                await Record.create(newRecord);
            }
            const records = await Record.find({}).sort({ id: -1 });
            res.json({ success: true, history: records });
        } catch (err) {
            res.status(500).json({ error: 'Database write failed' });
        }
    } else {
        console.warn("⚠️ Using in-memory storage (Database not connected)");
        const index = inMemoryHistory.findIndex(r => r.id === newRecord.id);
        if (index !== -1) {
            inMemoryHistory[index] = newRecord;
        } else {
            inMemoryHistory.unshift(newRecord);
        }
        res.json({ success: true, history: inMemoryHistory });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
