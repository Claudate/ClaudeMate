const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

async function uploadRelease() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is not set.');
    console.error('Please set it using: set GITHUB_TOKEN=your_token');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/upload-release.js <owner/repo> [tag]');
    console.error('Example: node scripts/upload-release.js jackySun521/claudate v1.0.0');
    process.exit(1);
  }

  const [repoStr, tagArg] = args;
  const [owner, repo] = repoStr.split('/');
  const tag = tagArg || `v${version}`;

  if (!owner || !repo) {
    console.error('Error: Invalid repo format. Use owner/repo');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  console.log(`Preparing release ${tag} for ${owner}/${repo}...`);

  try {
    // 1. Create or get release
    let release;
    try {
      release = await octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag,
      });
      console.log(`Found existing release: ${release.data.html_url}`);
    } catch (e) {
      if (e.status === 404) {
        console.log('Creating new release...');
        release = await octokit.repos.createRelease({
          owner,
          repo,
          tag_name: tag,
          name: `ClaudeMate ${tag}`,
          draft: true,
          prerelease: false,
          generate_release_notes: true,
        });
        console.log(`Created release: ${release.data.html_url}`);
      } else {
        throw e;
      }
    }

    // 2. Upload assets
    const buildOutput = path.join(__dirname, '../build-output1');
    const exeFile = fs.readdirSync(buildOutput).find(f => f.endsWith('.exe'));

    if (!exeFile) {
      console.error('Error: No .exe file found in build-output1/');
      process.exit(1);
    }

    const assetPath = path.join(buildOutput, exeFile);
    const assetName = exeFile;
    const assetSize = fs.statSync(assetPath).size;
    const assetData = fs.readFileSync(assetPath);

    console.log(`Uploading ${assetName} (${(assetSize / 1024 / 1024).toFixed(2)} MB)...`);

    // Check if asset already exists
    const existingAssets = await octokit.repos.listReleaseAssets({
      owner,
      repo,
      release_id: release.data.id,
    });

    const existingAsset = existingAssets.data.find(a => a.name === assetName);
    if (existingAsset) {
      console.log('Asset already exists, deleting old one...');
      await octokit.repos.deleteReleaseAsset({
        owner,
        repo,
        asset_id: existingAsset.id,
      });
    }

    await octokit.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.data.id,
      name: assetName,
      data: assetData,
      headers: {
        'content-type': 'application/vnd.microsoft.portable-executable',
        'content-length': assetSize,
      },
    });

    console.log('Upload complete!');
    console.log(`Release URL: ${release.data.html_url}`);

  } catch (error) {
    console.error('Release failed:', error.message);
    process.exit(1);
  }
}

uploadRelease();
