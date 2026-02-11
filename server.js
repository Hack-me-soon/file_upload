require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(express.static('public'));

// 1. Create a queue lock
let isProcessing = false;
const queue = [];

const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;
    
    isProcessing = true;
    const task = queue.shift();
    const { file, fileName, resolve, reject } = task;
    
    const uniqueId = Math.random().toString(36).substring(7);
    const WORK_DIR = path.join('/tmp', `repo-${uniqueId}`);
    const targetDir = path.join(WORK_DIR, 'Uploaded_files');

    try {
        console.log(`📦 Starting queue task: ${fileName}`);
        const GITHUB_URL = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}.git`;

        await git.clone({
            fs, http, dir: WORK_DIR,
            url: GITHUB_URL,
            singleBranch: true, depth: 1,
            onAuth: () => ({ username: process.env.GITHUB_PAT })
        });

        await fs.ensureDir(targetDir);
        await fs.move(file.filepath, path.join(targetDir, fileName));

        await git.add({ fs, dir: WORK_DIR, filepath: `Uploaded_files/${fileName}` });
        await git.commit({
            fs, dir: WORK_DIR,
            message: `Upload: ${fileName}`,
            author: { name: 'Queue Bot', email: 'bot@render.com' }
        });

        await git.push({
            fs, http, dir: WORK_DIR,
            onAuth: () => ({ username: process.env.GITHUB_PAT })
        });

        console.log(`✅ ${fileName} pushed.`);
        await fs.remove(WORK_DIR);
        resolve();
    } catch (error) {
        console.error(`❌ Queue Error:`, error.message);
        await fs.remove(WORK_DIR);
        reject(error);
    } finally {
        isProcessing = false;
        // Start next item in queue
        processQueue();
    }
};

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({ 
        maxFileSize: 100 * 1024 * 1024, 
        uploadDir: '/tmp' 
    });

    form.parse(req, (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Upload failed" });
        
        const file = files.file[0];
        const fileName = `${Date.now()}-${file.originalFilename}`;

        // Add to queue instead of processing immediately
        new Promise((resolve, reject) => {
            queue.push({ file, fileName, resolve, reject });
            processQueue();
        }).catch(e => console.log("Queue task failed"));

        // Tell browser we received it (clears the browser connection)
        res.status(202).json({ success: true });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Queue Server live on ${PORT}`));