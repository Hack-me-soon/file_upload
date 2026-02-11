require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static('public'));

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({
        maxFileSize: 100 * 1024 * 1024, // 100MB
        keepExtensions: true,
        uploadDir: '/tmp' // Stream directly to disk
    });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Stream error" });

        const file = files.file[0]; // Formidable v3 syntax
        const tempPath = file.filepath;

        try {
            console.log(`📡 Stream Complete: ${file.originalFilename}. Encoding...`);
            
            const octokit = new Octokit({ 
                auth: process.env.GITHUB_PAT,
                request: { timeout: 120000 }
            });

            // Convert to Base64 (The RAM-heavy part)
            const content = fs.readFileSync(tempPath, { encoding: 'base64' });
            const gitPath = `Uploaded_files/${Date.now()}-${file.originalFilename}`;

            console.log("🚀 Pushing to GitHub... (This is where the 30s timeout usually hits)");

            await octokit.repos.createOrUpdateFileContents({
                owner: process.env.GITHUB_OWNER,
                repo: process.env.GITHUB_REPO,
                path: gitPath,
                message: `Stream Upload: ${file.originalFilename}`,
                content: content
            });

            console.log("✅ GitHub Success!");
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            res.status(200).json({ success: true });

        } catch (error) {
            console.error("❌ Process Failed:", error.message);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            if (!res.headersSent) res.status(500).json({ error: error.message });
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));