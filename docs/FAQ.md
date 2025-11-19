# ClaudeCode.works - Frequently Asked Questions (FAQ)

## 📦 Installation & Setup

### Q: How do I install ClaudeCode.works?

**macOS:**
1. Download the `.dmg` file from https://claudecode.works
2. Open the DMG
3. Drag the app to your Applications folder
4. **First time**: Right-click the app → Select "Open" → Click "Open" in the dialog

**Windows:**
1. Download the `.exe` installer from https://claudecode.works
2. Run the installer
3. If Windows SmartScreen appears: Click "More info" → "Run anyway"
4. Follow the installation wizard

**Via Package Managers:**
```bash
# macOS - Homebrew
brew install --cask claudecode-works

# Windows - Scoop
scoop bucket add extras
scoop install claudecode-works

# Windows - Chocolatey
choco install claudecode-works
```

---

### Q: Why does macOS say the app is from an "unidentified developer"?

This happens because we're a new application and the code signing process takes time.

**Solution:**
1. Right-click (or Control-click) the app
2. Select "Open" from the menu
3. Click "Open" in the security dialog

You only need to do this once. After that, you can open it normally.

**Note**: We're working on getting our Apple Developer certificate. Future versions will be properly signed.

---

### Q: Windows SmartScreen is blocking the installation. Is this safe?

Yes, it's safe! SmartScreen flags new applications that haven't built up "reputation" yet.

**How to proceed:**
1. Click "More info" on the SmartScreen warning
2. Click "Run anyway"

**Why this happens:**
- We're a new application
- Building SmartScreen reputation requires thousands of downloads
- We're working on code signing certificate

**Verify the download:**
Check the SHA256 hash on our GitHub Releases page to ensure the file hasn't been tampered with.

---

### Q: Do I need a Claude API subscription?

**Yes**, ClaudeCode.works requires your own Claude API key.

**How to get one:**
1. Go to https://console.anthropic.com
2. Sign up for an account
3. Add payment method (Anthropic charges for API usage)
4. Generate an API key
5. Copy it into ClaudeCode.works settings

**Pricing** (as of Jan 2025):
- Claude 3.5 Sonnet: $3 per million input tokens, $15 per million output tokens
- Pay-as-you-go (no subscription)

**Note**: ClaudeCode.works itself is free. You only pay Anthropic for API usage.

---

### Q: Where is my API key stored? Is it safe?

Your API key is stored **locally on your computer** in the system keychain:

- **macOS**: Keychain Access
- **Windows**: Windows Credential Manager
- **Linux**: libsecret

**We never:**
- Send your API key to our servers (we don't even have servers!)
- Store it in plain text
- Share it with anyone

**Security measures:**
- Encrypted storage via `electron-store`
- Sandboxed renderer process
- No telemetry by default
- Open source code (audit it yourself!)

---

### Q: Can I use this without an internet connection?

**Partially**, but not fully:

**Works offline:**
- View past conversations
- Browse your projects
- Search chat history
- Access local files

**Requires internet:**
- New AI conversations (calls Claude API)
- Auto-updates
- Documentation links

**Why**: Claude's AI models run on Anthropic's servers, so you need internet to interact with Claude.

---

## 🎨 Features & Usage

### Q: What's the difference between ClaudeCode.works and the Claude Code CLI?

| Feature | ClaudeCode.works | Claude Code CLI |
|---------|------------------|-----------------|
| **Interface** | GUI (VSCode-like) | Terminal |
| **Chat History** | Persistent, searchable | Session-only |
| **Project Management** | Visual, multi-project | Manual directory navigation |
| **File Browser** | Built-in | Use system tools |
| **Learning Curve** | Lower (visual) | Higher (commands) |
| **Performance** | ~150MB RAM | ~50MB RAM |
| **Keyboard-First** | Optional | Required |

**Use ClaudeCode.works if:**
- You prefer visual interfaces
- You want persistent chat history
- You manage multiple projects
- You're new to AI coding tools

**Use CLI if:**
- You live in the terminal
- You want minimal resource usage
- You integrate with shell scripts
- You're a CLI purist

**Can I use both?** Yes! They're complementary.

---

### Q: How do I switch between projects?

**Method 1: Sidebar**
1. Click the project icon in the left sidebar
2. Select from recent projects
3. Or click "Open Project" to browse

**Method 2: Keyboard**
- Press `Cmd/Ctrl + P`
- Type project name
- Press Enter

**Method 3: Drag & Drop**
Drag a folder onto the app window

**Pro tip**: Projects are remembered, so switching back is instant!

---

### Q: Can I search my chat history?

**Yes!** Search is one of our core features.

**How to search:**
1. Press `Cmd/Ctrl + F`
2. Type your query
3. Results appear with highlights

**Search supports:**
- Full-text search
- Code snippets
- Date filters (coming in v0.2)
- Regular expressions (advanced)

**Search across:**
- Current conversation
- All conversations in a project
- All projects (global search)

---

### Q: How do I export my conversations?

**Currently (v0.1):**
Right-click a conversation → "Export" → Choose format:
- Markdown (`.md`)
- JSON (`.json`)
- Plain text (`.txt`)

**Coming in v0.2:**
- Export multiple conversations
- Export as PDF
- Include code files
- Share conversations via link

---

### Q: Does this support [language/framework]?

**Yes!** ClaudeCode.works supports any language or framework that Claude Code supports, including:

- **Languages**: JavaScript, TypeScript, Python, Go, Rust, Java, C++, Ruby, PHP, etc.
- **Frameworks**: React, Vue, Angular, Django, Flask, Rails, Spring, etc.
- **Tools**: Git, Docker, Kubernetes, Terraform, etc.

The underlying AI is Claude, so if Claude can help with it, ClaudeCode.works can too.

---

### Q: Can multiple people use the same installation?

**Not recommended for shared machines**, but you can:

**Option 1: Separate User Accounts (Recommended)**
Each OS user has their own:
- Settings
- API key
- Chat history
- Projects

**Option 2: Manual Profile Switching (Coming Soon)**
v0.3 will support multiple profiles in one installation.

**Team Features:**
For teams, check out our roadmap for v0.3:
- Shared workspaces
- Team API key pools
- Conversation sharing
- Role-based access

---

## 🔒 Privacy & Security

### Q: Does ClaudeCode.works collect telemetry?

**By default: NO.**

We respect your privacy:
- ❌ No tracking by default
- ❌ No analytics sent to us
- ❌ No crash reports (unless you opt-in)

**Optional telemetry** (opt-in):
In Settings, you can enable:
- Anonymous crash reports (via Sentry)
- Anonymous usage statistics (help us improve)

**What we NEVER collect:**
- Your code
- Your conversations
- Your API keys
- Personal information
- Project names/paths

**Open source**: Audit the code yourself at https://github.com/YOUR_REPO

---

### Q: Is my code sent to your servers?

**No, because we don't have servers!**

**Here's what happens:**
1. You write code or ask a question
2. ClaudeCode.works sends it directly to **Anthropic's API** (using your API key)
3. Claude responds
4. We display the response

**Your code goes:**
Your Computer → Anthropic's Servers → Your Computer

**NOT:**
Your Computer → Our Servers → Anthropic → Our Servers → Your Computer

**What does Anthropic do with your code?**
See Anthropic's privacy policy: https://www.anthropic.com/privacy

---

### Q: Can I use this for confidential/proprietary code?

**Use at your own risk.** Consider:

**✅ Anthropic's protections:**
- They claim not to train on API data (as of Jan 2025)
- SOC 2 Type II certified
- GDPR compliant

**⚠️ Considerations:**
- Code is sent to external servers (Anthropic)
- Subject to their privacy policy
- Check your company's policies

**Alternatives for sensitive code:**
- Use Claude with Anthropic's Enterprise plan (additional guarantees)
- Self-host AI models (not supported by ClaudeCode.works yet)
- Avoid sharing proprietary code in prompts

**Future**: We're exploring integration with self-hosted models.

---

### Q: How do you handle updates? Is auto-update safe?

**Auto-Update Process:**
1. App checks GitHub Releases for new versions
2. If available, downloads update in background
3. Verifies signature (once we have code signing)
4. Prompts you to install
5. You decide when to restart

**Security:**
- Updates only from official GitHub releases
- Signature verification (upcoming)
- No forced updates
- You can disable auto-update

**Manual updates:**
Download new version from https://claudecode.works

---

## 💰 Pricing & Licensing

### Q: How much does ClaudeCode.works cost?

**$0. Forever. Free.**

ClaudeCode.works is 100% free and open source (MIT license).

**What you pay for:**
- **Claude API usage** (to Anthropic, pay-as-you-go)

That's it. No hidden costs, no subscriptions, no "Pro" plans.

---

### Q: If it's free, how do you make money?

**Currently:** We don't! This is a passion project.

**Future possibilities** (maybe):
- GitHub Sponsors (voluntary donations)
- Premium features for enterprises (cloud sync, SSO, etc.)
- Consulting/custom development for companies
- Training courses on AI-assisted development

**Commitment:**
The core app will **always** be free and open source.

---

### Q: Can I use this commercially?

**Yes!** MIT License allows:
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use

**No restrictions** on:
- Company size
- Revenue
- Number of users

**Only requirement:**
Include the MIT license notice if you redistribute.

---

### Q: Can I fork this and make my own version?

**Absolutely!** That's the point of open source.

**You can:**
- Fork the repo
- Modify it however you want
- Rebrand it
- Sell it (though we'd appreciate attribution!)

**We only ask:**
- Keep the MIT license
- Give credit (optional but appreciated)
- Consider contributing improvements back!

**Popular forks welcome:**
- Company-specific versions
- Localized versions
- Specialized workflows
- Different AI providers

---

## 🛠️ Troubleshooting

### Q: The app won't start. What do I do?

**Try these steps:**

**1. Check system requirements:**
- macOS 10.13+ or Windows 10+
- 4GB RAM minimum (8GB recommended)
- 200MB free disk space

**2. Look for error logs:**

**macOS:**
```bash
~/Library/Logs/ClaudeCode.works/main.log
```

**Windows:**
```
%APPDATA%\ClaudeCode.works\logs\main.log
```

**3. Reset settings:**

**macOS:**
```bash
rm -rf ~/Library/Application\ Support/ClaudeCode.works
```

**Windows:**
```cmd
rmdir /s "%APPDATA%\ClaudeCode.works"
```

**4. Reinstall:**
Uninstall completely, then reinstall fresh.

**5. Still broken?**
Open an issue on GitHub with:
- Your OS and version
- Error logs
- Steps to reproduce

---

### Q: Chat responses are slow or timing out

**Possible causes:**

**1. Anthropic API issues**
Check https://status.anthropic.com

**2. Network problems**
Test your connection:
```bash
curl https://api.anthropic.com
```

**3. API rate limits**
You may be hitting Anthropic's rate limits. Wait a few minutes.

**4. Large context**
Very large codebases can slow responses. Try:
- Focusing on specific files
- Reducing context window
- Breaking up queries

**5. API key issues**
Verify your API key is valid in Settings.

---

### Q: My conversations disappeared!

**Don't panic!** They're probably still there.

**Check:**

**1. Wrong project selected?**
Switch to the correct project in sidebar.

**2. Search for them:**
Press `Cmd/Ctrl + F` and search for keywords.

**3. Check backups:**

**macOS:**
```bash
~/Library/Application\ Support/ClaudeCode.works/backups/
```

**Windows:**
```
%APPDATA%\ClaudeCode.works\backups\
```

**4. Still missing?**
Check if data files exist:

**macOS:**
```bash
ls ~/Library/Application\ Support/ClaudeCode.works/conversations/
```

**Windows:**
```cmd
dir "%APPDATA%\ClaudeCode.works\conversations\"
```

**If files are there but not showing**, open a GitHub issue.

---

### Q: High memory usage - is this normal?

**Typical usage:**
- Idle: ~150MB
- Active conversation: ~200-300MB
- Large codebase open: ~400-500MB

**If higher:**

**1. Check for memory leaks:**
- How long has the app been running?
- Try restarting the app

**2. Clear cache:**
Settings → Advanced → Clear Cache

**3. Reduce chat history:**
Settings → Chat → Limit history to last 100 messages

**4. Close unused projects:**
Only keep active projects open.

**5. Report if persistent:**
If memory grows continuously, that's a bug. Please report!

---

### Q: The app is crashing frequently

**Immediate fixes:**

**1. Update to latest version**
Check for updates in app or download from website.

**2. Disable plugins** (if any)
Settings → Plugins → Disable all

**3. Reset settings**
Settings → Advanced → Reset to Defaults

**4. Check conflicts:**
- Antivirus software
- Other Electron apps
- System updates pending

**5. Enable crash reporting:**
Settings → Privacy → Enable crash reports

Then reproduce the crash. We'll get the report and investigate.

**6. Open an issue:**
If crashes persist, report on GitHub with:
- Crash logs
- Steps to reproduce
- System information

---

## 🚀 Features & Roadmap

### Q: What features are planned?

**v0.2 (Next 4-6 weeks):**
- [ ] Plugin system
- [ ] Vim mode
- [ ] Custom themes
- [ ] Keyboard shortcuts editor
- [ ] Date-based search filters
- [ ] Batch export conversations

**v0.3 (Q1 2025):**
- [ ] Multi-profile support
- [ ] Team collaboration features
- [ ] Cloud sync (optional)
- [ ] Mobile companion app
- [ ] Advanced code analysis
- [ ] Integration marketplace

**Future (no ETA):**
- [ ] Self-hosted AI model support
- [ ] Voice input
- [ ] AI-powered code review
- [ ] Git integration
- [ ] Jira/Linear integration
- [ ] VS Code extension

**See full roadmap:** https://github.com/YOUR_REPO/projects/1

---

### Q: Can I request a feature?

**Yes!** We love feature requests.

**How to request:**
1. Check existing requests: https://github.com/YOUR_REPO/issues?q=is:issue+label:enhancement
2. If not found, open a new issue
3. Use the "Feature Request" template
4. Describe: What problem does it solve? How would it work?

**What happens next:**
- We review all requests
- Community can vote (👍 reactions)
- Popular requests get prioritized
- Some get built quickly, others take time

**Want it faster?**
- Contribute code (we'll help!)
- Sponsor development (GitHub Sponsors)
- Hire us for custom development

---

### Q: Does this support Vim keybindings?

**v0.1:** No (but planned for v0.2!)

**v0.2:** Yes! Vim mode coming soon.

**Meanwhile:**
If you're comfortable with code, you can contribute:
- Issue: https://github.com/YOUR_REPO/issues/XX
- Good first contribution!

---

### Q: Can I customize the theme/colors?

**v0.1:** Limited (Dark/Light presets only)

**v0.2:** Full theme customization:
- Custom color schemes
- Import/export themes
- Community theme marketplace

**v0.3:** Visual theme editor

**Want to contribute?**
We'd love help building the theme system!

---

## 🤝 Contributing & Community

### Q: How can I contribute?

**Many ways to help!**

**1. Code contributions:**
- Check `good first issue` label
- Read CONTRIBUTING.md
- Submit PRs

**2. Bug reports:**
- Test the app
- Report issues
- Provide detailed repro steps

**3. Documentation:**
- Improve README
- Write tutorials
- Translate docs

**4. Design:**
- UI/UX improvements
- Icons and assets
- Theme designs

**5. Community:**
- Answer questions on Discord
- Help other users
- Share your workflows

**6. Spread the word:**
- Star on GitHub
- Tweet about it
- Write blog posts

**7. Financial support:**
- GitHub Sponsors (coming soon)
- Buy us coffee ☕

---

### Q: I'm not a developer. Can I still help?

**Absolutely!**

**Non-coding contributions:**
- **Testing**: Use the app and report bugs
- **Writing**: Improve documentation
- **Design**: Create graphics, UI mockups
- **Translation**: Localize to your language
- **Community**: Help others in Discord/forums
- **Advocacy**: Share on social media, write reviews

**All contributions valued!**

---

### Q: Is there a community Discord/Slack?

**Yes!** Join our Discord: https://discord.gg/YOUR_INVITE

**Channels:**
- #general - General discussion
- #help - Get support
- #showcase - Share your projects
- #development - Developer talk
- #feature-requests - Discuss new features
- #off-topic - Hang out

**Community guidelines:**
- Be respectful
- Help others
- No spam
- Follow Code of Conduct

---

### Q: How do I report a security vulnerability?

**DO NOT open a public issue!**

**Instead:**
1. Email: security@claudecode.works
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Your contact info (if you want credit)

**We will:**
- Acknowledge within 48 hours
- Investigate and patch
- Credit you (if desired) when fixed
- Notify you when it's safe to disclose

**See full policy:** SECURITY.md in our repo

---

## 🌍 Miscellaneous

### Q: Does this work on Linux?

**Not officially (yet), but:**

**Experimental support:**
Some users report success running on Linux:
- Ubuntu 20.04+
- Fedora 35+
- Arch (btw)

**Build from source:**
```bash
git clone https://github.com/YOUR_REPO
cd claudecode-works
npm install
npm run build:linux
```

**Official Linux support:**
Planned for v0.3 (Q1 2025)

**Help wanted:**
If you're a Linux user, we'd love help with testing and packaging!

---

### Q: Can I use this on a tablet/mobile?

**Not currently.**

ClaudeCode.works is designed for desktop.

**Mobile companion app** is on the roadmap for v0.3:
- View conversations on mobile
- Quick coding queries
- Sync with desktop app

**Web version?**
Not planned. Desktop-first for:
- Better file system access
- Lower latency
- Offline capabilities
- Native performance

---

### Q: What languages is the UI available in?

**v0.1:**
- English only

**v0.2 (planned):**
- Chinese (Simplified)
- Japanese
- Spanish
- French
- German

**Want to help translate?**
Join our localization effort: https://github.com/YOUR_REPO/wiki/Translation

---

### Q: Does this work with other AI models (GPT-4, Gemini, etc.)?

**No, ClaudeCode.works is Claude-specific.**

**Why only Claude?**
- Deep integration with Claude Code features
- Optimized for Claude's capabilities
- Focused scope = better quality

**Want other models?**
Check out:
- **Continue.dev** - Multi-model support
- **Cursor** - GPT-4 and others
- **Cody** - Multiple providers

**Could you add other models?**
Maybe in the future, but no promises. Our focus is being the best Claude client.

---

### Q: I found a bug. Where do I report it?

**GitHub Issues:** https://github.com/YOUR_REPO/issues

**Before reporting:**
1. Search existing issues (might be known)
2. Update to latest version (might be fixed)
3. Check if it's reproducible

**When reporting include:**
- **Title**: Short, descriptive (e.g., "App crashes when opening large files")
- **Steps to reproduce**: Numbered list
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **System info**: OS, version, etc.
- **Logs**: Attach relevant logs
- **Screenshots/video**: If applicable

**Good bug reports** help us fix issues faster!

---

### Q: How often are updates released?

**Target cadence:**

- **Major versions** (0.x): Every 2-3 months
- **Minor updates** (0.x.y): Every 2-3 weeks
- **Patches** (0.x.y): As needed for critical bugs

**How to update:**
- Auto-update notification (default)
- Check manually: Help → Check for Updates
- Download from website

**Release notes:**
Every release has detailed notes on GitHub.

---

### Q: Can I sponsor the project?

**Not yet, but soon!**

We're setting up:
- **GitHub Sponsors**
- **Open Collective**

**Meanwhile, you can:**
- Star the repo ⭐
- Contribute code
- Spread the word

**When sponsorship is available:**
Funds will go toward:
- Code signing certificates
- Server costs (future features)
- Contributor rewards
- Development time

**We'll announce** when it's ready!

---

## 📞 Still Have Questions?

**Didn't find your answer?**

- 💬 **Discord**: https://discord.gg/YOUR_INVITE
- 🐛 **GitHub Issues**: https://github.com/YOUR_REPO/issues
- 📧 **Email**: support@claudecode.works
- 🐦 **Twitter**: @claudecodeworks

**We're here to help!** 🙏

---

*Last updated: [Date]*
*For latest FAQ, visit: https://claudecode.works/faq*
