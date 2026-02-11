require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

app.use(cors());
app.use(express.static('public'));

// The Upload Route
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
        const content = req.file.buffer.toString('base64');
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const filePath = `Uploaded_files/${fileName}`;

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: filePath,
            message: `Render Upload: ${req.file.originalname}`,
            content: content
        });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));