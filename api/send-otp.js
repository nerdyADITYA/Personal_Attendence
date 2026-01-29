
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error("MONGODB_URI missing");
    cachedDb = await mongoose.connect(MONGODB_URI);
    return cachedDb;
}

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 } // Expires in 5 minutes
});
const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        await connectToDatabase();
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
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (error) {
                    console.error("SMTP Connection Failed:", error);
                    reject(new Error("SMTP Connection Failed: " + error.message));
                } else {
                    console.log("SMTP Connection Successful. Server is ready to take messages.");
                    resolve(success);
                }
            });
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
        console.error("Send OTP Process Error:", err);
        return res.status(500).json({ error: "Failed to send OTP: " + err.message });
    }
}
