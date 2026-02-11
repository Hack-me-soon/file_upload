require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static('public'));

// 1. Store files in /tmp (Render allows temporary disk usage)
const upload = multer({ dest: '/tmp/' }); 

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file.");

        // Send response immediately to satisfy the proxy
        res.status(200).json({ success: true });

        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

        // 2. Read file from disk instead of RAM
        const fileBuffer = fs.readFileSync(req.file.path);
        const content = fileBuffer.toString('base64');
        const fileName = `${Date.now()}-${req.file.originalname}`;

        console.log(`Pumping ${fileName} to GitHub...`);

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: `Uploaded_files/${fileName}`,
            message: `Disk Upload: ${req.file.originalname}`,
            content: content
        });

        // 3. CLEANUP: Delete the temp file from Render's disk
        fs.unlinkSync(req.file.path);
        console.log("✅ GitHub Push Complete & RAM/Disk Cleared");

    } catch (err) {
        console.error("Background Error:", err.message);
        // Delete file even if it fails
        if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));