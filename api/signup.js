
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    createdAt: { type: Date, default: Date.now, expires: 300 }
});
const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        await connectToDatabase();
        const { username, password, email, otp } = req.body;

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

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
        return res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
        return res.status(500).json({ error: "Signup failed: " + err.message });
    }
}
