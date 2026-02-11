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
        maxFileSize: 100 * 1024 * 1024, 
        uploadDir: '/tmp' 
    });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Upload failed" });
        
        const file = files.file[0];
        const fileName = `${Date.now()}-${file.originalFilename}`;
        
        // UNIQUE DIR for every request to avoid "Refspec" errors
        const uniqueId = Math.random().toString(36).substring(7);
        const WORK_DIR = path.join('/tmp', `repo-${uniqueId}`);
        const targetDir = path.join(WORK_DIR, 'Uploaded_files');

        try {
            // Respond 202 immediately to keep the frontend happy
            res.status(202).json({ success: true });

            const GITHUB_URL = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`;

            // 1. Clone into the UNIQUE directory
            await git.clone({
                fs, http, dir: WORK_DIR,
                url: GITHUB_URL,
                singleBranch: true, depth: 1,
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            // 2. Move file into the unique cloned repo
            await fs.ensureDir(targetDir);
            await fs.move(file.filepath, path.join(targetDir, fileName));

            // 3. Git Add, Commit, and Push
            await git.add({ fs, dir: WORK_DIR, filepath: `Uploaded_files/${fileName}` });
            await git.commit({
                fs, dir: WORK_DIR,
                message: `Upload: ${fileName}`,
                author: { name: 'Render Bot', email: 'bot@render.com' }
            });

            await git.push({
                fs, http, dir: WORK_DIR,
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            console.log(`✅ ${fileName} successfully pushed!`);

            // 4. CLEANUP: Remove the unique folder to save Render disk space
            await fs.remove(WORK_DIR);

        } catch (error) {
            console.error(`❌ Git Error for ${fileName}:`, error.message);
            // Cleanup on failure too
            await fs.remove(WORK_DIR);
            if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));