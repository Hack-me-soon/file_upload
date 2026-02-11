require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");
const path = require('path');

const app = express();

// IMPORTANT: Increase the body limits for the server
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));

// Setup Multer with 100MB limit
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } 
});

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
        
        // Processing large files into Base64
        const content = req.file.buffer.toString('base64');
        const fileName = `${Date.now()}-${req.file.originalname}`;

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: `Uploaded_files/${fileName}`,
            message: `Upload: ${req.file.originalname}`,
            content: content
        });

        // Explicitly help Garbage Collection by nullifying the large variable
        delete req.file.buffer; 

        res.json({ success: true });
    } catch (error) {
        console.error("Upload failed:", error.message);
        res.status(500).json({ error: "GitHub API or Server limit reached: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));