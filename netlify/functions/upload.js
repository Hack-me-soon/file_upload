const { Octokit } = require("@octokit/rest");
const multipart = require('lambda-multipart-parser');

exports.handler = async (event) => {
    // Basic Security: Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // Netlify functions receive events, so we parse the form data
        const result = await multipart.parse(event);
        const file = result.files[0];
        
        const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
        
        // Path includes the folder name you requested
        const path = `Uploaded_files/${Date.now()}-${file.filename}`;
        const content = file.content.toString('base64');

        await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            path: path,
            message: `Web Upload: ${file.filename}`,
            content: content
        });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};