const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVER_PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

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

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const recordSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Linked to User
    date: String,
    day: String,
    punchIn: String,
    punchOut: String,
    duration: String,
    status: String,
    timestamp: String
});

const User = mongoose.model('User', userSchema);
const Record = mongoose.model('Record', recordSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Auth Routes
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Basic validation
        if (!username || !password) return res.status(400).json({ error: "Missing fields" });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: "Username already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword });

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: "Signup failed: " + err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (err) {
        res.status(500).json({ error: "Login failed: " + err.message });
    }
});

// Protected Attendance Routes
app.get('/api/attendance', authenticateToken, async (req, res) => {
    if (mongoose.connection.readyState === 1) {
        try {
            // Filter by userId
            const records = await Record.find({ userId: req.user.userId }).sort({ id: -1 });
            res.json(records);
        } catch (err) {
            res.status(500).json({ error: 'Database read failed' });
        }
    } else {
        res.status(503).json({ error: "Database not connected" });
    }
});

app.post('/api/attendance', authenticateToken, async (req, res) => {
    const newRecord = req.body;

    // Ensure userId is set from token, not body (security)
    newRecord.userId = req.user.userId;

    if (mongoose.connection.readyState === 1) {
        try {
            const existing = await Record.findOne({ id: newRecord.id }); // Check by timestamp ID
            // Ideally should also check userId matches existing record to prevent overwriting others (though ID collision unlikely with timestamp)

            if (existing) {
                // Ensure user owns the record they are updating
                if (existing.userId.toString() !== req.user.userId) {
                    return res.status(403).json({ error: "Unauthorized" });
                }
                await Record.updateOne({ id: newRecord.id }, newRecord);
            } else {
                await Record.create(newRecord);
            }

            // Return updated list for this user
            const records = await Record.find({ userId: req.user.userId }).sort({ id: -1 });
            res.json({ success: true, history: records });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Database write failed' });
        }
    } else {
        res.status(503).json({ error: "Database not connected" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
