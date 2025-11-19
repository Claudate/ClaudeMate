# Security Policy

## Our Commitment

Security is a top priority for ClaudeCode.works. We take all security vulnerabilities seriously and appreciate the security community's efforts to responsibly disclose issues.

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

**Note:** As we're in early development (v0.x), we recommend always using the latest version.

## Reporting a Vulnerability

### DO NOT Create a Public Issue

If you discover a security vulnerability, please **DO NOT** open a public GitHub issue.

### How to Report

Send a detailed report to: **security@claudecode.works**

Include:
- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Your contact information** (if you'd like credit or updates)

### PGP Encryption (Optional)

For sensitive reports, you can encrypt your email using our PGP key:

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[Your PGP public key here]
-----END PGP PUBLIC KEY BLOCK-----
```

Key fingerprint: `[Your fingerprint]`

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Status Updates**: Every 7 days until resolved
- **Fix Timeline**: Depends on severity (see below)

### Severity Levels

**Critical** (Fix: 1-7 days)
- Remote code execution
- Authentication bypass
- API key exposure
- Data breach

**High** (Fix: 7-14 days)
- Privilege escalation
- Local code execution
- Information disclosure
- Significant data leakage

**Medium** (Fix: 14-30 days)
- XSS vulnerabilities
- CSRF vulnerabilities
- Moderate information disclosure

**Low** (Fix: 30-60 days)
- Minor information disclosure
- Issues requiring specific user interaction
- Theoretical vulnerabilities

## Our Process

1. **Receive & Acknowledge**
   - Confirm receipt within 48 hours
   - Assign a tracking ID

2. **Investigate**
   - Validate the vulnerability
   - Assess severity and impact
   - Determine affected versions

3. **Develop Fix**
   - Create a patch
   - Test thoroughly
   - Prepare release notes

4. **Coordinated Disclosure**
   - Notify reporter
   - Prepare security advisory
   - Release fix
   - Publish CVE (if applicable)

5. **Public Disclosure**
   - After fix is released
   - Credit reporter (if desired)
   - Publish details in security advisory

## What We Ask From You

### Responsible Disclosure

- Give us reasonable time to fix the issue before public disclosure
- Do not exploit the vulnerability beyond proof-of-concept
- Do not access, modify, or delete user data
- Do not perform destructive testing (DoS, data destruction, etc.)
- Do not violate privacy of other users

### Testing Guidelines

**Allowed:**
- Testing on your own installations
- Security research on public, non-production infrastructure
- Automated scanning (within rate limits)

**Not Allowed:**
- Testing on other users' data or installations
- Social engineering of staff or users
- Physical attacks on infrastructure
- Denial of Service attacks
- Spam or other disruptive actions

## Scope

### In Scope

**ClaudeCode.works Application:**
- Desktop application (macOS/Windows)
- Auto-update mechanism
- Local data storage
- API key management
- IPC communication

**Infrastructure:**
- claudecode.works website
- Update servers
- Download servers

### Out of Scope

**Third-Party Services:**
- Anthropic's Claude API (report to Anthropic)
- GitHub (report to GitHub)
- CDN providers
- DNS providers

**Physical Security:**
- Physical access attacks
- Social engineering

**Issues We Won't Fix:**
- Denial of Service requiring physical access
- Attacks requiring compromised OS/hardware
- Issues in unsupported/EOL versions
- Issues requiring malicious browser extensions

## Recognition

### Hall of Fame

Security researchers who responsibly disclose valid vulnerabilities will be:

- Listed in our Security Hall of Fame (with permission)
- Credited in release notes and security advisories
- Eligible for ClaudeCode.works swag (when available)

**Note:** We currently do not have a bug bounty program.

### Current Security Hall of Fame

*List will be updated as researchers report vulnerabilities*

---

## Security Best Practices for Users

### Protect Your API Keys

- Never share your Claude API key
- Use environment variables or secure storage
- Rotate keys if compromised
- Monitor API usage regularly

### Keep Software Updated

- Enable auto-updates (Settings → General → Auto-update)
- Check for updates regularly
- Read security advisories

### Verify Downloads

Before installing, verify the integrity of downloads:

```bash
# macOS/Linux
shasum -a 256 ClaudeCode.works-[version].dmg

# Windows (PowerShell)
Get-FileHash ClaudeCode.works-[version].exe -Algorithm SHA256
```

Compare with checksums on our [Releases page](https://github.com/YOUR_REPO/releases).

### Report Suspicious Activity

If you notice suspicious behavior:
- Unexpected network traffic
- Unauthorized API usage
- Strange application behavior
- Suspicious update prompts

Report to: security@claudecode.works

### Use Antivirus

While ClaudeCode.works is safe, we recommend:
- Running antivirus software
- Keeping your OS updated
- Being cautious with plugins (when plugin system launches)

---

## Security Features

ClaudeCode.works implements several security measures:

### Application Security

- **Sandboxed Renderer**: Renderer process runs in sandbox
- **Context Isolation**: Prevents prototype pollution
- **No Node Integration**: Renderer doesn't have direct Node.js access
- **CSP Headers**: Content Security Policy enforced
- **Secure IPC**: All inter-process communication validated

### Data Security

- **Encrypted Storage**: API keys encrypted using system keychain
  - macOS: Keychain Access
  - Windows: Credential Manager
  - Linux: libsecret
- **Local Storage**: All data stored locally, never transmitted to our servers
- **No Telemetry by Default**: Opt-in only

### Network Security

- **HTTPS Only**: All external communications over HTTPS
- **Certificate Validation**: SSL certificates properly validated
- **No Remote Code**: No remote code execution
- **Minimal Permissions**: Requests minimal system permissions

### Update Security

- **Signed Updates**: Updates signed with code signing certificate (when available)
- **HTTPS Delivery**: Updates delivered over HTTPS
- **Checksum Validation**: Update integrity verified before installation

---

## Security Advisories

Published security advisories can be found at:
- GitHub Security Advisories: https://github.com/YOUR_REPO/security/advisories
- Website: https://claudecode.works/security

Subscribe to security notifications:
- GitHub: Watch repository → Custom → Security alerts
- Email: Subscribe at https://claudecode.works/security/subscribe

---

## Compliance & Standards

ClaudeCode.works follows industry security standards:

- **OWASP Top 10**: Application security best practices
- **Electron Security Checklist**: All recommended security features enabled
- **CWE Top 25**: Mitigations for common weaknesses

---

## Code Security

### Dependency Management

- Regular dependency updates via Dependabot
- Automated security scanning with npm audit
- Manual review of critical dependencies

### Code Review

- All code reviewed before merging
- Security-focused code reviews
- Automated linting and type checking

### Static Analysis

- TypeScript strict mode
- ESLint security rules
- Regular security audits

---

## Contact

**Security Team Email:** security@claudecode.works

**PGP Key Fingerprint:** [Your fingerprint]

**Response Time:**
- Acknowledge: 48 hours
- Assessment: 5 business days

---

## Changes to This Policy

This security policy may be updated from time to time. Significant changes will be announced via:
- GitHub repository
- Security mailing list
- Website

---

**Last Updated:** [Current Date]

**Version:** 1.0

---

Thank you for helping keep ClaudeCode.works and our users safe! 🔒
