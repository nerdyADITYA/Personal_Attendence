const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const nodemailer = require('nodemailer');

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
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true }
});

const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 } // Expires in 5 minutes
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
    timestamp: String,
    lastReminderSentAt: Date // New field for reminder tracking
});

const User = mongoose.model('User', userSchema);
const Record = mongoose.model('Record', recordSchema);
const OTP = mongoose.model('OTP', otpSchema);

// Email Transporter (Same as before)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Reminder Logic
const SHIFT_DURATION_MS = 9.5 * 60 * 60 * 1000; // 9.5 hours
const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function checkReminders() {
    console.log("Checking for shift reminders...");
    if (mongoose.connection.readyState !== 1) return;

    try {
        // Find active records (no punchOut)
        // We might want to filter by date to avoid processing very old stuck records, but user might want these reminders.
        // Let's stick to records created in the last 24 hours to be safe? 
        // Or just all active records. Let's do all active records but ensure we don't spam.

        const activeRecords = await Record.find({
            punchOut: null,
            // Ensure we have a timestamp to calculate from
            timestamp: { $exists: true }
        }).populate('userId');

        const now = new Date();

        for (const record of activeRecords) {

            if (!record.userId || !record.userId.email) continue;

            let punchInTime;
            // Parse timestamp which is expected to be ISO string from client
            try {
                punchInTime = new Date(record.timestamp);
                if (isNaN(punchInTime.getTime())) continue; // Invalid date
            } catch (e) {
                console.error("Error parsing timestamp for record", record.id, e);
                continue;
            }

            const elapsed = now - punchInTime;

            if (elapsed > SHIFT_DURATION_MS) {
                // Check if we should send a reminder
                const lastSent = record.lastReminderSentAt ? new Date(record.lastReminderSentAt) : null;

                if (!lastSent || (now - lastSent) >= REMINDER_INTERVAL_MS) {
                    // Send Email
                    console.log(`Sending reminder to ${record.userId.email} for record ${record.id}`);

                    try {
                        await transporter.sendMail({
                            from: process.env.SMTP_EMAIL,
                            to: record.userId.email,
                            subject: 'Shift Ended - Please Punch Out',
                            text: `Hello ${record.userId.username},\n\nYour shift of 9.5 hours has ended. Please remember to punch out.\n\nIgnore this message if you are doing overtime.`,
                            html: `
                                <h2>Shift Ended Reminder</h2>
                                <p>Hello <b>${record.userId.username}</b>,</p>
                                <p>Your shift of 9.5 hours has ended. Please remember to punch out.</p>
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

    } catch (err) {
        console.error("Error in checkReminders:", err);
    }
}

// Run check every minute
setInterval(checkReminders, 60 * 1000);

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

// Send OTP
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email, username } = req.body;

        if (!email || !username) return res.status(400).json({ error: "Missing email or username" });

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (existingUser.email === email) return res.status(400).json({ error: "Email already registered" });
            if (existingUser.username === username) return res.status(400).json({ error: "Username already taken" });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP
        await OTP.create({ email, otp });

        // Verify SMTP connection
        console.log("Attempting to connect to SMTP server...");
        // Non-blocking verify for logs
        transporter.verify(function (error, success) {
            if (error) {
                console.error("SMTP Connection Failed:", error);
            } else {
                console.log("SMTP Connection Successful.");
            }
        });

        // Send Email
        console.log(`Attempting to send OTP email to ${email}...`);
        const info = await transporter.sendMail({
            from: process.env.SMTP_EMAIL,
            to: email,
            subject: 'Your Signup OTP',
            text: `Your OTP for signup is: ${otp}. It expires in 5 minutes.`,
            html: `<p>Your OTP for signup is: <b>${otp}</b>. It expires in 5 minutes.</p>`
        });
        console.log("Email sent successfully. Message ID:", info.messageId);

        return res.json({ success: true, message: "OTP sent successfully" });
    } catch (err) {
        console.error("Send OTP Error:", err);
        return res.status(500).json({ error: "Failed to send OTP: " + err.message });
    }
});

// Signup with OTP verification
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, email, otp } = req.body;
        // Basic validation
        if (!username || !password || !email || !otp) return res.status(400).json({ error: "Missing fields" });

        // Verify OTP
        const validOtp = await OTP.findOne({ email, otp });
        if (!validOtp) return res.status(400).json({ error: "Invalid or expired OTP" });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: "Username already exists" });

        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(400).json({ error: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword, email });

        // Delete used OTP
        await OTP.deleteOne({ _id: validOtp._id });

        // Send Confirmation Email
        console.log(`Attempting to send details confirmation email to ${email}...`);
        try {
            await transporter.sendMail({
                from: process.env.SMTP_EMAIL,
                to: email,
                subject: 'Welcome to Personal Attendance App!',
                text: `Hello ${username},\n\nYour account has been successfully registered.\n\nWelcome aboard!`,
                html: `
                    <h2>Welcome to Personal Attendance App!</h2>
                    <p>Hello <b>${username}</b>,</p>
                    <p>Your account has been successfully registered.</p>
                    <p>You can now login and start tracking your attendance.</p>
                `
            });
            console.log("Confirmation details email sent successfully.");
        } catch (emailErr) {
            console.error("Failed to send confirmation email:", emailErr);
            // Don't fail the request if email fails, just log it
        }

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Signup failed: " + err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Check for username OR email
        const user = await User.findOne({ $or: [{ username: username }, { email: username }] });

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
