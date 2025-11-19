# ClaudeCode.works

> Making Claude Code Work Better

<p align="center">
  <img src="assets/logo.png" alt="ClaudeCode.works Logo" width="200"/>
</p>

<p align="center">
  <a href="https://github.com/YOUR_USERNAME/claudecode-works/releases"><img src="https://img.shields.io/github/v/release/YOUR_USERNAME/claudecode-works" alt="Release"></a>
  <a href="https://github.com/YOUR_USERNAME/claudecode-works/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/YOUR_USERNAME/claudecode-works/stargazers"><img src="https://img.shields.io/github/stars/YOUR_USERNAME/claudecode-works" alt="Stars"></a>
  <a href="https://github.com/YOUR_USERNAME/claudecode-works/network/members"><img src="https://img.shields.io/github/forks/YOUR_USERNAME/claudecode-works" alt="Forks"></a>
  <a href="https://discord.gg/YOUR_INVITE"><img src="https://img.shields.io/discord/YOUR_DISCORD_ID" alt="Discord"></a>
</p>

<p align="center">
  <b>An open-source desktop application that brings a beautiful, VSCode-inspired interface to Anthropic's Claude Code.</b>
</p>

<p align="center">
  <a href="https://claudecode.works">Website</a> •
  <a href="https://claudecode.works/docs">Documentation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## ✨ Features

### 🎨 Beautiful Interface
- **VSCode-inspired layout** - Familiar design for developers
- **Dark & Light themes** - Auto-switching based on system preferences
- **Custom frameless window** - Native-like experience
- **Responsive design** - Adapts to your screen size

### 💬 Persistent Chat History
- **Never lose conversations** - All chats saved locally
- **Powerful search** - Find anything across all conversations
- **Export conversations** - Markdown, JSON, or plain text
- **Organize by project** - Keep contexts separate

### 📁 Project Management
- **Multi-project support** - Switch between projects effortlessly
- **Built-in file explorer** - Browse your codebase
- **Project settings** - Per-project configurations
- **Quick switching** - `Cmd/Ctrl + P` to switch projects

### 🌏 Multi-Language Optimized
- **CJK tokenization** - Optimized for Chinese, Japanese, Korean
- **Smart word wrapping** - Proper handling of Asian languages
- **i18n ready** - Interface localization coming soon

### 🔒 Secure & Private
- **Local-first** - Your data stays on your computer
- **Encrypted API keys** - Stored in system keychain
- **Sandboxed renderer** - Security by design
- **No telemetry by default** - Opt-in only

### ⚡ Fast & Lightweight
- **~150MB memory** - Optimized for performance
- **Code splitting** - Fast initial load
- **Virtual scrolling** - Handle thousands of messages
- **Lazy loading** - Load what you need, when you need it

---

## 📸 Screenshots

<p align="center">
  <img src="assets/screenshots/main-dark.png" alt="Main Interface Dark Mode" width="800"/>
  <br/>
  <em>Main interface with dark theme</em>
</p>

<p align="center">
  <img src="assets/screenshots/chat-light.png" alt="Chat Interface" width="800"/>
  <br/>
  <em>Chat interface with syntax highlighting</em>
</p>

<p align="center">
  <img src="assets/screenshots/project-management.png" alt="Project Management" width="800"/>
  <br/>
  <em>Multi-project management</em>
</p>

---

## 📦 Download

### Latest Release

| Platform | Download |
|----------|----------|
| **macOS (Intel)** | [Download DMG](https://github.com/YOUR_USERNAME/claudecode-works/releases/latest/download/ClaudeCode.works-Intel.dmg) |
| **macOS (Apple Silicon)** | [Download DMG](https://github.com/YOUR_USERNAME/claudecode-works/releases/latest/download/ClaudeCode.works-ARM.dmg) |
| **Windows** | [Download EXE](https://github.com/YOUR_USERNAME/claudecode-works/releases/latest/download/ClaudeCode.works-Setup.exe) |
| **Linux** | Coming soon |

### Package Managers

```bash
# macOS - Homebrew
brew install --cask claudecode-works

# Windows - Scoop
scoop bucket add extras
scoop install claudecode-works

# Windows - Chocolatey
choco install claudecode-works
```

### System Requirements

- **macOS:** 10.13 (High Sierra) or later
- **Windows:** Windows 10 (64-bit) or later
- **RAM:** 4GB minimum, 8GB recommended
- **Disk Space:** 200MB

---

## 🚀 Quick Start

### 1. Install

Download and install ClaudeCode.works for your platform (see [Download](#-download)).

**macOS users:** Right-click → Open on first launch (security requirement).

**Windows users:** If SmartScreen appears, click "More info" → "Run anyway".

### 2. Get Claude API Key

1. Visit [Anthropic Console](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (you'll need it next)

### 3. Configure ClaudeCode.works

1. Launch ClaudeCode.works
2. Enter your API key when prompted
3. (Optional) Open a project folder
4. Start chatting with Claude!

### 4. Start Coding!

Try asking Claude:
- "Explain the structure of this codebase"
- "Write unit tests for this function"
- "Refactor this code for better readability"
- "Find potential bugs in this file"

---

## 📚 Documentation

- **[User Guide](https://claudecode.works/docs)** - Complete documentation
- **[FAQ](https://claudecode.works/faq)** - Common questions
- **[Keyboard Shortcuts](https://claudecode.works/docs/shortcuts)** - Speed up your workflow
- **[Troubleshooting](https://claudecode.works/docs/troubleshooting)** - Fix common issues
- **[API Reference](https://claudecode.works/docs/api)** - For developers

---

## 🎬 Demo

Watch the 3-minute walkthrough:

[![ClaudeCode.works Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)

---

## 🛠️ Tech Stack

<details>
<summary><b>Click to expand</b></summary>

### Core
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[React](https://react.dev/)** - UI components

### UI/UX
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[Heroicons](https://heroicons.com/)** - Icon library
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** - Code editor (VSCode's editor)

### State & Storage
- **[Zustand](https://github.com/pmndrs/zustand)** - State management
- **[electron-store](https://github.com/sindresorhus/electron-store)** - Persistent storage

### Build & Tooling
- **[Vite](https://vitejs.dev/)** - Fast build tool
- **[electron-builder](https://www.electron.build/)** - Package & distribute
- **[electron-updater](https://www.electron.build/auto-update)** - Auto-updates

### Security & Monitoring
- **Context Isolation** - Enabled
- **Sandboxed Renderer** - Enabled
- **[Sentry](https://sentry.io/)** - Error tracking (opt-in)

</details>

---

## 🤝 Contributing

We welcome contributions from the community! 🎉

### Ways to Contribute

- 🐛 **Report bugs** - Open an [issue](https://github.com/YOUR_USERNAME/claudecode-works/issues)
- 💡 **Suggest features** - Use the [feature request template](https://github.com/YOUR_USERNAME/claudecode-works/issues/new?template=feature_request.yml)
- 🔧 **Submit PRs** - Check out [good first issues](https://github.com/YOUR_USERNAME/claudecode-works/labels/good%20first%20issue)
- 📖 **Improve docs** - Documentation is never perfect
- 🌍 **Translate** - Help localize the app
- 💬 **Help others** - Answer questions on [Discord](https://discord.gg/YOUR_INVITE)

### Getting Started

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/claudecode-works.git
   cd claudecode-works
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run in Development**
   ```bash
   npm run dev
   ```

4. **Make Changes**
   - Create a branch: `git checkout -b feature/your-feature`
   - Make your changes
   - Test thoroughly
   - Commit: `git commit -m "Add your feature"`

5. **Submit PR**
   - Push: `git push origin feature/your-feature`
   - Open a Pull Request
   - Fill out the PR template

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for detailed guidelines.

---

## 🌟 Community

Join our growing community!

- **[Discord](https://discord.gg/YOUR_INVITE)** - Chat with users and contributors
- **[GitHub Discussions](https://github.com/YOUR_USERNAME/claudecode-works/discussions)** - Ask questions, share ideas
- **[Twitter](https://twitter.com/claudecodeworks)** - Follow for updates
- **[Newsletter](https://claudecode.works/newsletter)** - Biweekly updates

---

## 📊 Roadmap

### v0.2 (Next Release)
- [ ] Plugin system
- [ ] Vim mode
- [ ] Custom themes
- [ ] Keyboard shortcuts editor
- [ ] Date-based search filters

### v0.3 (Q1 2025)
- [ ] Multi-profile support
- [ ] Team collaboration features
- [ ] Cloud sync (optional)
- [ ] Mobile companion app
- [ ] Advanced code analysis

### Future
- [ ] Self-hosted AI model support
- [ ] Voice input
- [ ] Git integration
- [ ] VS Code extension
- [ ] Linux official support

See the [full roadmap](https://github.com/YOUR_USERNAME/claudecode-works/projects/1) on GitHub Projects.

---

## 💰 Pricing

**Free. Forever. Open Source.**

ClaudeCode.works is 100% free and open source (MIT License).

You only need your own Claude API key from Anthropic:
- **Claude 3.5 Sonnet:** ~$3 per million input tokens, ~$15 per million output tokens
- **Pay-as-you-go** (no subscription required)

### Support the Project

If you find ClaudeCode.works useful:
- ⭐ **Star the repo** - It helps others discover the project
- 💬 **Spread the word** - Tweet, blog, tell your friends
- 🐛 **Report bugs** - Help us improve
- 🤝 **Contribute code** - PRs welcome!
- 💰 **Sponsor** (coming soon) - GitHub Sponsors

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ℹ️ Liability and warranty limitations apply

### Third-Party Licenses

ClaudeCode.works uses various open-source libraries. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for details.

---

## 🙏 Acknowledgments

Built with ❤️ by the open-source community.

**Special thanks to:**
- **[Anthropic](https://www.anthropic.com/)** - For Claude AI
- **[Electron](https://www.electronjs.org/)** - For the amazing framework
- **[VSCode](https://code.visualstudio.com/)** - For design inspiration
- All [contributors](https://github.com/YOUR_USERNAME/claudecode-works/graphs/contributors)
- Everyone who starred, forked, or shared the project

---

## 🔒 Security

We take security seriously. See [SECURITY.md](SECURITY.md) for:
- Security policy
- Reporting vulnerabilities
- Security best practices

**Found a security issue?** Email security@claudecode.works (do NOT open a public issue).

---

## 📞 Support

### Need Help?

1. **[Documentation](https://claudecode.works/docs)** - Check the docs first
2. **[FAQ](https://claudecode.works/faq)** - Common questions answered
3. **[Discord](https://discord.gg/YOUR_INVITE)** - Community support
4. **[GitHub Issues](https://github.com/YOUR_USERNAME/claudecode-works/issues)** - Bug reports & feature requests

### Contact

- **Website:** https://claudecode.works
- **Email:** support@claudecode.works
- **Twitter:** [@claudecodeworks](https://twitter.com/claudecodeworks)
- **Discord:** [Join Server](https://discord.gg/YOUR_INVITE)

---

## 📈 Stats

<p align="center">
  <img src="https://repobeats.axiom.co/api/embed/YOUR_REPOBEATS_ID.svg" alt="Repobeats analytics" />
</p>

---

## ⭐ Star History

<p align="center">
  <a href="https://star-history.com/#YOUR_USERNAME/claudecode-works&Date">
    <img src="https://api.star-history.com/svg?repos=YOUR_USERNAME/claudecode-works&type=Date" alt="Star History Chart" width="600">
  </a>
</p>

---

## 🗺️ Localization

ClaudeCode.works is available in:
- 🇺🇸 English (default)
- 🇨🇳 Chinese (Simplified) - Coming in v0.2
- 🇯🇵 Japanese - Coming in v0.2

Want to help translate? See [LOCALIZATION.md](docs/LOCALIZATION.md)

---

<p align="center">
  <b>Built with Claude Code, for Claude Code users.</b>
  <br/>
  <br/>
  <a href="https://claudecode.works">claudecode.works</a> •
  <a href="https://github.com/YOUR_USERNAME/claudecode-works">GitHub</a> •
  <a href="https://discord.gg/YOUR_INVITE">Discord</a> •
  <a href="https://twitter.com/claudecodeworks">Twitter</a>
  <br/>
  <br/>
  Made with ❤️ by the open-source community
  <br/>
  <br/>
  <a href="https://github.com/YOUR_USERNAME/claudecode-works/stargazers">⭐ Star us on GitHub</a> if you find this useful!
</p>

---

<p align="center">
  <sub>© 2025 ClaudeCode.works. Released under MIT License.</sub>
</p>
