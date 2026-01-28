
# Personal Attendance App

A React-based attendance tracking application that calculates work duration, status (Late, Overtime, Absent), and stores data in the cloud.

## Features
- **Vercel Deployment Ready**: Serverless API integration.
- **Persistent Storage**: MongoDB Atlas integration for secure, portable data.
- **Smart Status Formula**: Automatically calculates 'LP' (Late Present), 'OP' (Overtime Present), 'OA' (Overtime Absent), etc.
- **Exports**: Export monthly attendance to Excel.

## Setup & Deployment

### 1. Prerequisites
- Node.js installed.
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (Free Tier is fine).
- A [Vercel](https://vercel.com/) account.

### 2. Local Development
To run the app locally with the backend API:

Install Vercel CLI:
```bash
npm i -g vercel
```

Run with Vercel Dev (Simulates the cloud environment):
```bash
vercel dev
```
*Note: You will need to set up your `.env` locally or link to Vercel project to access environment variables.*

### 3. Deploying to Vercel

1. **Push to GitHub**: Make sure your code is committed to a GitHub repository.
2. **Import to Vercel**: Go to Vercel Dashboard -> Add New -> Project -> Import your repo.
3. **Configure Environment Variables**:
   - In Vercel Project Settings > Environment Variables, add:
     - `MONGODB_URI`: Your MongoDB connection string (e.g., `mongodb+srv://<user>:<password>@cluster0.mongodb.net/attendance?retryWrites=true&w=majority`).
4. **Deploy**: Click Deploy!

## Database Migration
This app previously used a local `attendance.json` file. It has been upgraded to use MongoDB.
- All new records will be saved to the database.
- If the database connection fails, it falls back to temporary in-memory storage (data lost on refresh).
