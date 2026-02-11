require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");

const app = express();
app.use(express.static('public'));

// Use a slightly smaller limit to stay safe within Render's Free RAM
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 70 * 1024 * 1024 } 
});

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        // 1. Send an IMMEDIATE response to the browser
        // This prevents the 502 timeout because the connection "finishes" successfully
        res.status(202).json({ success: true, message: "Upload started in background" });

        // 2. Now do the heavy lifting in the background
        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
        const content = req.file.buffer.toString('base64');
        const fileName = `${Date.now()}-${req.file.originalname}`;

        console.log(`Processing ${fileName} in background...`);

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: `Uploaded_files/${fileName}`,
            message: `Large Upload: ${req.file.originalname}`,
            content: content
        });

        console.log(`Successfully pushed ${fileName} to GitHub.`);
        
        // Cleanup
        req.file.buffer = null;

    } catch (error) {
        // Since the response was already sent, we just log errors to the Render console
        console.error("Background Upload Failed:", error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));