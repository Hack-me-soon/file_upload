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
    const form = new formidable.IncomingForm({ maxFileSize: 100 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Upload failed" });
        
        const file = files.file[0];
        const fileName = `${Date.now()}-${file.originalFilename}`;
        const targetDir = path.join(REPO_DIR, 'Uploaded_files');

        try {
            // 1. Tell browser we started
            res.status(200).json({ success: true, message: "Git Protocol Push Started..." });

            // 2. Clean and Clone the repo (shallow clone to save RAM)
            await fs.remove(REPO_DIR);
            await git.clone({
                fs, http, dir: REPO_DIR,
                url: GITHUB_URL,
                singleBranch: true, depth: 1,
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            // 3. Move file into the cloned repo
            await fs.ensureDir(targetDir);
            await fs.move(file.filepath, path.join(targetDir, fileName));

            // 4. Git Add, Commit, and Push
            await git.add({ fs, dir: REPO_DIR, filepath: `Uploaded_files/${fileName}` });
            
            await git.commit({
                fs, dir: REPO_DIR,
                message: `Git Push: ${fileName}`,
                author: { name: 'Uploader AI', email: 'uploader@render.com' }
            });

            console.log("🚀 Starting Git Protocol Push...");
            await git.push({
                fs, http, dir: REPO_DIR,
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            console.log("✅ Git Protocol Push Successful!");
        } catch (error) {
            console.error("❌ Git Protocol Error:", error.message);
        }
    });
});

app.listen(3000, () => console.log('Server running on 3000'));