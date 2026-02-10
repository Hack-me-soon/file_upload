const multipart = require('lambda-multipart-parser');

exports.handler = async (event) => {
    // 1. Only allow POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // 2. Dynamic Import of Octokit (Fixes the ESM error)
        const { Octokit } = await import("@octokit/rest");
        
        // 3. Parse the file from the request
        const result = await multipart.parse(event);
        const file = result.files[0];

        if (!file) {
            return { statusCode: 400, body: JSON.stringify({ error: "No file uploaded" }) };
        }

        // 4. Initialize Octokit with your secret token
        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
        
        const path = `Uploaded_files/${Date.now()}-${file.filename}`;
        const content = file.content.toString('base64');

        // 5. Push to GitHub
        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: path,
            message: `Upload ${file.filename} via WebApp`,
            content: content
        });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error("Upload Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};