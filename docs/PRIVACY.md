# Privacy Policy

**Effective Date:** [Insert Date]
**Last Updated:** [Insert Date]

## Introduction

Welcome to ClaudeCode.works ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data.

This privacy policy explains:
- What data we collect (spoiler: very little!)
- How we use it
- Your rights and choices

**TL;DR:** We don't collect or store your data. Everything stays on your computer. We don't have servers that collect your information.

---

## Our Privacy Principles

1. **Privacy by Default**: No telemetry unless you opt in
2. **Local First**: Your data stays on your computer
3. **No Tracking**: We don't track your behavior
4. **Transparency**: Open source code you can audit
5. **Your Control**: You own your data

---

## What Data We Collect

### Data We DO NOT Collect

We **DO NOT** collect, store, or transmit:

- ❌ Your code or projects
- ❌ Your conversations with Claude
- ❌ Your API keys (stored locally only)
- ❌ File names, paths, or content
- ❌ Project information
- ❌ Usage patterns or analytics (unless opted in)
- ❌ IP addresses
- ❌ Device identifiers
- ❌ Location data
- ❌ Browsing history
- ❌ Cookies (we don't use them)

### Data We MAY Collect (Opt-In Only)

**Anonymous Usage Statistics** (If you enable in Settings → Privacy)

When enabled, we collect:
- Application version
- Operating system and version (e.g., "macOS 14.1")
- Anonymous installation ID (random UUID, not linked to you)
- Feature usage counts (e.g., "search used 5 times")
- Performance metrics (e.g., "app startup time: 2.3s")

**What we DON'T include even when opted in:**
- NO personally identifiable information
- NO code content
- NO conversation content
- NO file names or paths
- NO API keys

**Crash Reports** (If you enable in Settings → Privacy)

When enabled and the app crashes:
- Error message and stack trace
- Application version and OS
- Anonymous installation ID
- NO personal data or code content

We use Sentry for crash reporting (see Third-Party Services below).

---

## How We Use Data

### Anonymous Usage Statistics

If you opt in, we use aggregate data to:
- Understand which features are used most
- Identify performance bottlenecks
- Prioritize development efforts
- Improve user experience

**We NEVER:**
- Sell your data
- Share data with advertisers
- Use data for profiling
- Link data to your identity

### Crash Reports

If you opt in, crash reports help us:
- Fix bugs faster
- Improve stability
- Identify edge cases

### No Other Use

We don't use your data for any other purpose. Period.

---

## Where Your Data is Stored

### Local Storage

**All your actual data is stored locally** on your computer:

**Location:**
- **macOS:** `~/Library/Application Support/ClaudeCode.works/`
- **Windows:** `%APPDATA%\ClaudeCode.works\`
- **Linux:** `~/.config/ClaudeCode.works/`

**What's stored:**
- Conversation history
- Project settings
- Application preferences
- API keys (encrypted in system keychain)

**You have full control:**
- View files anytime
- Export or backup
- Delete whenever you want
- Not accessible to us

### Optional Cloud Storage

If you choose to:
- Use cloud sync features (future feature) - fully opt-in
- Backup to your own cloud storage

**Important:**
- We don't provide cloud storage
- You control where data goes
- You manage encryption
- We never see your data

---

## Third-Party Services

ClaudeCode.works integrates with or may use these third-party services:

### Anthropic (Claude API)

**What:** AI model provider
**Data sent:** Your prompts and code (when you use Claude features)
**Privacy Policy:** https://www.anthropic.com/privacy
**Your control:** You provide API key, you control what's sent

**Important:**
- We don't intercept or store data sent to Anthropic
- Communication is direct: Your computer ↔ Anthropic
- See Anthropic's privacy policy for their data handling

### GitHub (Auto-Updates)

**What:** Hosting for app updates
**Data sent:** None (public downloads)
**Privacy Policy:** https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement
**Your control:** Disable auto-updates in Settings

### Sentry (Crash Reporting - Opt-In Only)

**What:** Error tracking service
**Data sent:** Crash reports (if opted in)
**Privacy Policy:** https://sentry.io/privacy/
**Your control:** Settings → Privacy → Disable crash reports

**What's sent to Sentry:**
- Error messages and stack traces
- Application version
- Operating system
- Anonymous installation ID

**What's NOT sent:**
- Your code
- Conversation content
- Personal information
- API keys

### Package Managers (Optional)

If you install via Homebrew, Scoop, Chocolatey:
- Each has their own privacy policies
- We don't receive any information from these installations

---

## Your Rights

### Access Your Data

All your data is local. Access it anytime:
- View files in Application Support folder
- Export conversations (File → Export)
- Check settings (Settings → Privacy)

### Delete Your Data

You have the right to delete all data:

**Complete removal:**
```bash
# macOS
rm -rf ~/Library/Application\ Support/ClaudeCode.works
rm -rf ~/Library/Caches/ClaudeCode.works
rm -rf ~/Library/Logs/ClaudeCode.works

# Windows
rmdir /s "%APPDATA%\ClaudeCode.works"
rmdir /s "%LOCALAPPDATA%\ClaudeCode.works"

# Then uninstall the application
```

**Partial deletion:**
- Settings → Privacy → Clear All Data
- Deletes conversation history, keeps preferences

### Opt-Out of Telemetry

Telemetry is **opt-in by default** (disabled unless you enable it).

To confirm it's disabled:
- Settings → Privacy → Usage Statistics (should be OFF)
- Settings → Privacy → Crash Reports (should be OFF)

### Data Portability

Export your data anytime:
- Conversations: File → Export → Choose format (Markdown, JSON, TXT)
- Settings: File → Export Settings
- Automatic backups (if enabled): Settings → Backups

---

## Children's Privacy

ClaudeCode.works is not directed at children under 13 (or 16 in EU).

We don't knowingly collect data from children. If you're a parent and believe your child has provided data to us, contact privacy@claudecode.works.

---

## Data Security

### How We Protect Your Data

**Local Storage:**
- API keys encrypted using system keychain
- Conversation history stored in local database
- Settings stored in encrypted format (when sensitive)

**Network Communication:**
- All external communication over HTTPS
- Certificate validation
- No data sent to our servers (we don't have any!)

**Application Security:**
- Sandboxed renderer process
- Context isolation
- Regular security updates
- Open source (audit the code!)

### What You Should Do

**Best practices:**
- Keep ClaudeCode.works updated
- Use strong API keys
- Enable disk encryption (FileVault/BitLocker)
- Protect your computer with password
- Be cautious with plugins (when plugin system launches)

---

## International Users

ClaudeCode.works is developed in [Your Country] but available globally.

**Data Location:**
- All data stored locally on YOUR computer
- If you opt in to telemetry, data may be processed in US (Sentry servers)

**GDPR Compliance (EU Users):**
- Legal basis: Consent (for opt-in telemetry)
- Data minimization: We collect minimal data
- Right to erasure: Delete data anytime
- Data portability: Export anytime
- Transparent processing: This policy

**CCPA Compliance (California Users):**
- We don't sell personal information
- Right to know: This policy explains everything
- Right to delete: Delete data anytime
- Right to opt-out: Telemetry is opt-in only

---

## Changes to This Policy

We may update this privacy policy occasionally.

**When we do:**
- Update "Last Updated" date
- Notify users via app notification
- Post announcement on GitHub
- Email subscribers (if we have newsletter)

**Significant changes:**
- Require explicit consent
- Provide 30-day notice

**Your options:**
- Review changes
- Accept or opt-out
- Contact us with concerns

---

## Open Source & Auditing

ClaudeCode.works is open source (MIT License).

**You can:**
- Audit our code: https://github.com/YOUR_REPO
- Verify we do what we say
- Build from source
- Contribute improvements

**Privacy-related code:**
- Telemetry implementation: `src/telemetry/`
- Data storage: `src/storage/`
- Network requests: `src/api/`

---

## Contact Us

Questions about privacy?

**Email:** privacy@claudecode.works

**GitHub:** Open an issue at https://github.com/YOUR_REPO/issues

**Response time:** Within 5 business days

**Address:** [Your Business Address - if required in your jurisdiction]

---

## Specific Regional Information

### European Union (GDPR)

**Data Controller:** [Your Name/Organization]
**Representative:** [If applicable]
**DPO Contact:** privacy@claudecode.works

**Your GDPR rights:**
- Right to access
- Right to rectification
- Right to erasure
- Right to restrict processing
- Right to data portability
- Right to object
- Right to withdraw consent
- Right to lodge complaint with supervisory authority

**Legal basis for processing:**
- Consent (for opt-in telemetry)
- Legitimate interest (for essential app functionality)

### California (CCPA)

**Categories of personal information collected:**
- None, unless you opt in to telemetry
- If opted in: Device information, usage data (not linked to you personally)

**Purpose:**
- Improve application performance and stability

**Third parties data shared with:**
- Sentry (only if crash reporting enabled)
- None for any other purpose

**Selling personal information:**
- We do NOT sell personal information
- We have NOT sold personal information in the past 12 months

**Your CCPA rights:**
- Right to know
- Right to delete
- Right to opt-out of sale (N/A - we don't sell)
- Right to non-discrimination

---

## Cookie Policy

**We don't use cookies.**

Our desktop application doesn't use cookies, tracking pixels, or similar technologies.

Our website (claudecode.works) may use:
- Essential cookies (for basic functionality only)
- Analytics cookies (only if you consent)

See website cookie policy for details.

---

## Do Not Track

Our application doesn't track users, so Do Not Track (DNT) signals don't apply.

If you have telemetry disabled (default), we already don't track you.

---

## Summary

**In plain English:**

✅ Your data stays on your computer
✅ We don't collect anything by default
✅ Telemetry is opt-in only
✅ You can delete everything anytime
✅ We don't sell data (we don't have any to sell!)
✅ Open source - verify everything

**Questions?** Email privacy@claudecode.works

---

**Version:** 1.0
**Effective Date:** [Insert Date]
**Last Updated:** [Insert Date]

---

*This privacy policy is part of ClaudeCode.works, an open-source project.
View the source code: https://github.com/YOUR_REPO*
