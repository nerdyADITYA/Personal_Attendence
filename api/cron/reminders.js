const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Cached connection for serverless
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }

    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('MONGODB_URI is not defined.');
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

// Define Schemas (Must match server.js/attendance.js)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true }
});

const recordSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: String,
    day: String,
    punchIn: String,
    punchOut: String,
    duration: String,
    status: String,
    timestamp: String,
    lastReminderSentAt: Date,
    isHalfDay: { type: Boolean, default: false }
});

// Prevent model recompilation
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);

// Email Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

const SHIFT_DURATION_MS = 9.5 * 60 * 60 * 1000; // 9.5 hours
const HALF_DAY_DURATION_MS = 4.5 * 60 * 60 * 1000; // 4.5 hours
const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export default async function handler(req, res) {
    console.log("Cron job triggered: Checking reminders...");

    // Connect DB
    await connectToDatabase();
    if (mongoose.connection.readyState !== 1) {
        return res.status(500).json({ error: "Database not connected" });
    }

    try {
        // Find active records (no punchOut)
        const activeRecords = await Record.find({
            punchOut: null,
            timestamp: { $exists: true }
        }).populate('userId');

        const now = new Date();

        for (const record of activeRecords) {
            if (!record.userId || !record.userId.email) continue;

            let punchInTime;
            try {
                punchInTime = new Date(record.timestamp);
                if (isNaN(punchInTime.getTime())) continue;
            } catch (e) {
                console.error("Error parsing timestamp for record", record.id, e);
                continue;
            }

            const elapsed = now - punchInTime;
            const requiredDuration = record.isHalfDay ? HALF_DAY_DURATION_MS : SHIFT_DURATION_MS;

            if (elapsed > requiredDuration) {
                const lastSent = record.lastReminderSentAt ? new Date(record.lastReminderSentAt) : null;

                if (!lastSent || (now - lastSent) >= REMINDER_INTERVAL_MS) {
                    // Send Email
                    console.log(`Sending reminder to ${record.userId.email} for record ${record.id}`);

                    try {
                        await transporter.sendMail({
                            from: process.env.SMTP_EMAIL,
                            to: record.userId.email,
                            subject: 'Shift Ended - Please Punch Out',
                            text: `Hello ${record.userId.username},\n\nYour shift of ${record.isHalfDay ? '4.5' : '9.5'} hours has ended. Please remember to punch out.\n\nIgnore this message if you are doing overtime.`,
                            html: `
                                <h2>Shift Ended Reminder</h2>
                                <p>Hello <b>${record.userId.username}</b>,</p>
                                <p>Your shift of ${record.isHalfDay ? '4.5' : '9.5'} hours has ended. Please remember to punch out.</p>
                                <br>
                                <p><i>Ignore this message if you are doing overtime.</i></p>
                            `
                        });

                        // Update record
                        record.lastReminderSentAt = now;
                        await record.save();
                        console.log("Reminder sent and record updated.");

                    } catch (mailError) {
                        console.error("Failed to send reminder email:", mailError);
                    }
                }
            }
        }

        res.status(200).json({ success: true, message: "Reminders checked" });

    } catch (err) {
        console.error("Error in checkReminders:", err);
        res.status(500).json({ error: err.message });
    }
}
