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
    // 1. Immediately set a longer timeout for this specific request
    req.setTimeout(150000); 

    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const octokit = new Octokit({ 
            auth: process.env.GITHUB_PAT,
            request: { timeout: 90000 }
        });
        
        // Optimize: Convert to base64 using a more efficient method
        const content = req.file.buffer.toString('base64');
        const fileName = `${Date.now()}-${req.file.originalname}`;

        console.log(`Starting GitHub push for: ${fileName} (${req.file.size} bytes)`);

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: `Uploaded_files/${fileName}`,
            message: `Large Upload: ${req.file.originalname}`,
            content: content
        });

        // Free memory immediately
        req.file.buffer = null;

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Detailed Error:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));