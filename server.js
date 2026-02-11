require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require("@octokit/rest");
const cors = require('cors');

const app = express();

// 1. Force higher limits at the Express level
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));
app.use(cors());

// 2. Configure Multer to handle up to 100MB
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } 
});

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const octokit = new Octokit({ 
            auth: process.env.GITHUB_PAT,
            // Increase timeout for the GitHub API call itself
            request: { timeout: 60000 } 
        });
        
        const content = req.file.buffer.toString('base64');
        const fileName = `${Date.now()}-${req.file.originalname}`;

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: `Uploaded_files/${fileName}`,
            message: `Large Upload: ${req.file.originalname}`,
            content: content
        });

        // Clean up memory immediately
        req.file.buffer = null;

        res.json({ success: true });
    } catch (error) {
        console.error("Upload Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 3. IMPORTANT: Increase the server timeout to 2 minutes
server.timeout = 120000;