# Deployment Guide: MeetPune Chat App

Since your app uses **Socket.IO** (real-time chat), you cannot host the backend on Vercel Serverless functions easily. You need a service that keeps the server running 24/7.

We will use **Render** (free tier available) for the backend and **Vercel** for the frontend.

## Part 0: Get a Cloud Database (MongoDB Atlas)

**Your local `.env` string (`mongodb://localhost...`) will NOT work on Render.** You need a database in the cloud.

1.  Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and register for free.
2.  Create a **Shared Cluster** (Free).
3.  **Create a User**:
    - Username: `admin` (or similar)
    - Password: `your_password` (Make it secure, **remember it**).
4.  **Network Access**:
    - Go to "Network Access" -> "Add IP Address".
    - Select **"Allow Access from Anywhere"** (`0.0.0.0/0`). (Important for Render to connect).
5.  **Get Connection String**:
    - Click **"Connect"** -> **"Drivers"**.
    - Copy the string. It looks like: `mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
    - **Replace `<password>`** with the actual password you created in step 3.
    - **This is your `MONGODB_URI`.**

## Part 1: Deploy Backend to Render

1.  **Push your code to GitHub** (if you haven't already).
2.  **Sign up/Login to [Render.com](https://render.com/)**.
3.  Click **"New +"** -> **"Web Service"**.
4.  Connect your GitHub repository.
5.  **Configure the Service**:
    - **Name**: `meetpune-server` (or similar)
    - **Root Directory**: `server` (Important! Tell Render the code is in the server folder)
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node index.js` (or `npm start`)
    - **Instance Type**: `Free`
6.  **Environment Variables**:
    - **Variable 1**:
        - Name: `PORT`
        - Value: `3000`
    - **Variable 2**:
        - Click "Add Environment Variable"
        - Name: `MONGODB_URI`
        - Value: `your_mongodb_connection_string`
        - **IMPORTANT**: Do NOT use `mongodb://localhost...`. You need a cloud database URL (like from MongoDB Atlas). If you don't have one, the app will not work.
7.  Click **"Create Web Service"**.
8.  Wait for the deployment to finish. Render will give you a URL like `https://meetpune-server.onrender.com`. **Copy this URL.**

## Part 2: Update Frontend on Vercel

1.  Go to your **Vercel Dashboard**.
2.  Select your project (`three` or `meetpune`).
3.  Go to **Settings** -> **Environment Variables**.
4.  Find `VITE_API_URL`.
5.  **Edit** it and paste your **Render Backend URL** (e.g., `https://meetpune-server.onrender.com`).
    - *Note: Do not add a trailing slash `/` at the end.*
6.  Go to **Deployments** and **Redeploy** the latest commit to apply the changes.

## Part 3: Verify

1.  Open your Vercel App URL.
2.  Try to Login/Register.
3.  If it works, you are done! The "Failed to fetch" error should be gone.
