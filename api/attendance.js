const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // Added

// Cached connection for serverless
let cachedDb = null;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret'; // Added

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }

    // Get URI from environment variable
    // Default to a placeholder if not set, but it won't connect
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('MONGODB_URI is not defined in environment variables.');
        // Return null to indicate no DB connection possible
        return null;
    }

    try {
        const client = await mongoose.connect(MONGODB_URI);
        cachedDb = client;
        console.log('Connected to MongoDB');
        return cachedDb;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Define Schema
const recordSchema = new mongoose.Schema({
    id: { type: Number, required: true }, // Using timestamp as ID from frontend
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Added
    date: String,
    day: String,
    punchIn: String,
    punchOut: String,
    duration: String,
    status: String,
    timestamp: String,
    lastReminderSentAt: Date, // Added
    isHalfDay: { type: Boolean, default: false } // Added
});

// Prevent model recompilation in serverless hot reloads
const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);

// Helper for Token Verification
const verifyToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
};

// Fallback in-memory storage for when DB isn't configured (Demo mode)
let inMemoryHistory = [];

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Connect to DB
    let dbConnected = false;
    try {
        const db = await connectToDatabase();
        dbConnected = !!db;
    } catch (e) {
        console.error("DB Connection failed", e);
    }

    // Auth Check
    const user = verifyToken(req);
    if (!user && dbConnected) { // If using DB, we enforce auth. API clients needing mixed access isn't in scope.
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === 'GET') {
        if (dbConnected) {
            try {
                // Sort by id desc (newest first)
                const records = await Record.find({ userId: user.userId }).sort({ id: -1 });
                return res.status(200).json(records);
            } catch (err) {
                return res.status(500).json({ error: 'Database read failed' });
            }
        } else {
            // Fallback
            return res.status(200).json(inMemoryHistory);
        }
    }

    if (req.method === 'POST') {
        const newRecord = req.body;

        if (dbConnected) {
            try {
                newRecord.userId = user.userId; // Securely assign ID

                // Upsert logic
                // Check if exists
                const existing = await Record.findOne({ id: newRecord.id });
                if (existing) {
                    if (existing.userId.toString() !== user.userId) {
                        return res.status(403).json({ error: "Forbidden" });
                    }
                    // Update
                    await Record.updateOne({ id: newRecord.id }, newRecord);
                } else {
                    // Create
                    await Record.create(newRecord);
                }

                // Return updated list
                const records = await Record.find({ userId: user.userId }).sort({ id: -1 });
                return res.status(200).json({ success: true, history: records });

            } catch (err) {
                return res.status(500).json({ error: 'Database write failed' });
            }
        } else {
            // Fallback In-Memory (No user separation in fallback)
            const index = inMemoryHistory.findIndex(r => r.id === newRecord.id);
            if (index !== -1) {
                inMemoryHistory[index] = newRecord;
            } else {
                inMemoryHistory.unshift(newRecord);
            }
            return res.status(200).json({ success: true, history: inMemoryHistory });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
