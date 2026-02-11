require('dotenv').config();
const express = require('express');
const formidable = require('formidable');
const { Octokit } = require("@octokit/rest");
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static('public'));

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm({ maxFileSize: 100 * 1024 * 1024, uploadDir: '/tmp' });

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ error: "Stream error" });
        const file = files.file[0];
        const tempPath = file.filepath;

        try {
            res.status(200).json({ success: true, message: "Large file processing started..." });

            const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
            const owner = process.env.GITHUB_OWNER;
            const repo = process.env.GITHUB_REPO;

            // 1. Create a Blob (This handles larger files than the standard 'contents' API)
            console.log("Step 1: Creating Blob...");
            const { data: blob } = await octokit.git.createBlob({
                owner, repo,
                content: fs.readFileSync(tempPath, { encoding: 'base64' }),
                encoding: 'base64'
            });

            // 2. Get the latest commit SHA of the main branch
            const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
            const latestCommitSha = ref.object.sha;

            // 3. Create a Tree with your new file
            console.log("Step 2: Creating Tree...");
            const { data: tree } = await octokit.git.createTree({
                owner, repo,
                base_tree: latestCommitSha,
                tree: [{
                    path: `Uploaded_files/${Date.now()}-${file.originalFilename}`,
                    mode: '100644', // Normal file
                    type: 'blob',
                    sha: blob.sha
                }]
            });

            // 4. Create a Commit
            console.log("Step 3: Creating Commit...");
            const { data: commit } = await octokit.git.createCommit({
                owner, repo,
                message: `Large Upload: ${file.originalFilename}`,
                tree: tree.sha,
                parents: [latestCommitSha]
            });

            // 5. Update the reference
            await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.sha });

            console.log("✅ Successfully pushed large file via Git Data API!");
            fs.unlinkSync(tempPath);

        } catch (error) {
            console.error("❌ Git Data API Error:", error.message);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));