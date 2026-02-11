require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");

const app = express();
app.use(express.static('public'));

// Increase limits for the server
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } 
});

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file.");

        // IMPORTANT: We respond 200 immediately so the connection doesn't hang
        res.status(200).json({ success: true, message: "Server received file." });

        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
        const content = req.file.buffer.toString('base64');
        const path = `Uploaded_files/${Date.now()}-${req.file.originalname}`;

        console.log(`Pumping ${req.file.originalname} to GitHub...`);

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: path,
            message: `Upload: ${req.file.originalname}`,
            content: content
        });

        console.log("✅ Success!");
        req.file.buffer = null; // Clean RAM
    } catch (err) {
        console.error("❌ GitHub Error:", err.message);
    }
});

const PORT = process.env.PORT || 8000; // Koyeb likes 8000
app.listen(PORT, () => console.log(`Server on ${PORT}`));