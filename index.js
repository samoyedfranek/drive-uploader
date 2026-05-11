require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

app.use(express.static('public'));

const driveOauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
);
driveOauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });

const mockDatabase = {
    users: [
        {
            username: process.env.USER_NAME,
            hashedPassword: process.env.USER_PASSWORD
        }
    ]
};

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = mockDatabase.users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: "Invalid username or password" }); 
        }

        const match = await bcrypt.compare(password, user.hashedPassword);

        if (match) {
            res.status(200).json({ message: "Login successful", token: "sample-auth-token-123" });
        } else {
            res.status(401).json({ error: "Invalid username or password" });
        }
    } catch (error) {
        console.error("Auth Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/get-upload-url', async (req, res) => {
    const { filename, mimeType, size } = req.body;
    
    if (!filename || size === undefined || size === null) {
        return res.status(400).send('Missing file metadata.');
    }

    try {
        const { token } = await driveOauth2Client.getAccessToken();

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Length': size.toString(),
                'X-Upload-Content-Type': mimeType || 'application/octet-stream',
                'Origin': req.headers.origin || 'http://localhost:3000'
            },
            body: JSON.stringify({
                name: filename,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            })
        });

        const uploadUrl = response.headers.get('location');
        if (!uploadUrl) throw new Error('Failed to get upload URL from Google.');

        res.status(200).json({ uploadUrl });
    } catch (error) {
        console.error("Upload Session Error:", error);
        res.status(500).send("Could not initialize upload session.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`System online. Serving on http://localhost:${PORT}`));