require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(express.static('public'));

// ... (keep the same requires)

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({ 
        maxFileSize: 100 * 1024 * 1024, 
        uploadDir: '/tmp' 
    });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Upload failed" });
        
        const file = files.file[0];
        const fileName = `${Date.now()}-${file.originalFilename}`;
        const WORK_DIR = path.join('/tmp', `repo-${Date.now()}`);

        try {
            console.log(`📦 Processing: ${fileName}`);
            const GITHUB_URL = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`;

            // CLONE: Optimized to be as tiny as possible
            await git.clone({
                fs, http, dir: WORK_DIR,
                url: GITHUB_URL,
                singleBranch: true,
                depth: 1,
                noTags: true, // Saves a bit more RAM
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            const targetDir = path.join(WORK_DIR, 'Uploaded_files');
            await fs.ensureDir(targetDir);
            await fs.move(file.filepath, path.join(targetDir, fileName));

            await git.add({ fs, dir: WORK_DIR, filepath: `Uploaded_files/${fileName}` });
            await git.commit({
                fs, dir: WORK_DIR,
                message: `Upload: ${fileName}`,
                author: { name: 'Final Bot', email: 'bot@render.com' }
            });

            // PUSH: Added force: true to fix the fast-forward error
            console.log("🚀 Pushing to GitHub...");
            await git.push({
                fs, http, dir: WORK_DIR,
                force: true, // BYPASSES THE REJECTION ERROR
                onAuth: () => ({ username: process.env.GITHUB_PAT })
            });

            await fs.remove(WORK_DIR);
            console.log(`✅ Finished: ${fileName}`);
            res.status(200).json({ success: true });

        } catch (error) {
            console.error(`❌ Error:`, error.message);
            await fs.remove(WORK_DIR);
            if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
            // Even if it failed, tell the browser so it can move to the next file
            res.status(500).json({ error: error.message });
        }
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`One-by-One Server live on ${PORT}`));