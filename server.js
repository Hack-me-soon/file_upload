require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(express.static('public'));

const GITHUB_URL = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`;
const REPO_DIR = path.join('/tmp', 'repo-clone');

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({ 
        maxFileSize: 100 * 1024 * 1024, // 100MB
        uploadDir: '/tmp' 
    });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Upload failed" });
        
        const file = files.file[0];
        const fileName = `${Date.now()}-${file.originalFilename}`;
        const targetDir = path.join(REPO_DIR, 'Uploaded_files');

        try {
            // Respond 202 to the browser so the UI stays alive
            res.status(202).json({ success: true });

            // Clean previous attempts and clone
            await fs.remove(REPO_DIR);
            await git.clone({
                fs, http, dir: REPO_DIR,
                url: GITHUB_URL,
                singleBranch: true, depth: 1,
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            // Move file to repo folder
            await fs.ensureDir(targetDir);
            await fs.move(file.filepath, path.join(targetDir, fileName));

            // Git operations
            await git.add({ fs, dir: REPO_DIR, filepath: `Uploaded_files/${fileName}` });
            await git.commit({
                fs, dir: REPO_DIR,
                message: `Upload: ${fileName}`,
                author: { name: 'Render Bot', email: 'bot@render.com' }
            });

            await git.push({
                fs, http, dir: REPO_DIR,
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            console.log(`✅ ${fileName} successfully pushed!`);
        } catch (error) {
            console.error("❌ Git Error:", error.message);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));