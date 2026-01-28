
const mongoose = require('mongoose');

// Cached connection for serverless
let cachedDb = null;

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
    date: String,
    day: String,
    punchIn: String,
    punchOut: String,
    duration: String,
    status: String,
    timestamp: String
});

// Prevent model recompilation in serverless hot reloads
const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);

// Fallback in-memory storage for when DB isn't configured (Demo mode)
let inMemoryHistory = [];

export default async function handler(req, res) {
    // Common CORS headers (Vercel usually handles this if configured in vercel.json, 
    // but good to have for direct API calls if needed, though simpler is better)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

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
        console.error("DB Connection failed, falling back to basic handling", e);
    }

    if (req.method === 'GET') {
        if (dbConnected) {
            try {
                // Sort by id desc (newest first)
                const records = await Record.find({}).sort({ id: -1 });
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
                // Upsert logic
                // Check if exists
                const existing = await Record.findOne({ id: newRecord.id });
                if (existing) {
                    // Update
                    await Record.updateOne({ id: newRecord.id }, newRecord);
                } else {
                    // Create
                    await Record.create(newRecord);
                }

                // Return updated list
                const records = await Record.find({}).sort({ id: -1 });
                return res.status(200).json({ success: true, history: records });

            } catch (err) {
                return res.status(500).json({ error: 'Database write failed' });
            }
        } else {
            // Fallback In-Memory
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
