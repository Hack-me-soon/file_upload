require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");
const fs = require('fs');

const app = express();
app.use(express.static('public'));

// 1. Use Disk Storage to keep RAM usage near zero during download
const upload = multer({ dest: '/tmp/' }); 

app.post('/upload', upload.single('file'), async (req, res) => {
    // Keep reference to the file path for cleanup
    const tempPath = req.file ? req.file.path : null;

    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        console.log(`File received: ${req.file.originalname}. Starting GitHub push...`);

        const octokit = new Octokit({ 
            auth: process.env.GITHUB_PAT,
            request: { timeout: 120000 } // 2 minute timeout for GitHub
        });

        // 2. Read from disk. This is the moment RAM might spike.
        const fileBuffer = fs.readFileSync(tempPath);
        const content = fileBuffer.toString('base64');
        const path = `Uploaded_files/${Date.now()}-${req.file.originalname}`;

        // 3. PUSH AND WAIT (Do NOT send res.status(200) before this)
        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: path,
            message: `Upload: ${req.file.originalname}`,
            content: content
        });

        console.log("✅ GitHub push successful.");

        // 4. Cleanup and respond
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        res.status(200).json({ success: true, message: "Uploaded to GitHub!" });

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        
        // If we haven't sent a response yet, send the error
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));