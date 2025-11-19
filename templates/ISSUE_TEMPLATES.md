# ClaudeCode.works - GitHub Issue & PR Templates

## 📋 GitHub Issue Templates

### Setup Instructions

Create these files in `.github/ISSUE_TEMPLATE/` directory:

```
.github/
└── ISSUE_TEMPLATE/
    ├── config.yml
    ├── bug_report.yml
    ├── feature_request.yml
    ├── installation_issue.yml
    └── question.yml
```

---

## config.yml

```yaml
blank_issues_enabled: false
contact_links:
  - name: 💬 Discord Community
    url: https://discord.gg/YOUR_INVITE
    about: Ask questions and chat with the community
  - name: 📚 Documentation
    url: https://claudecode.works/docs
    about: Read the official documentation
  - name: ❓ FAQ
    url: https://claudecode.works/faq
    about: Frequently asked questions
```

---

## bug_report.yml

```yaml
name: 🐛 Bug Report
description: Report a bug or unexpected behavior
title: "[Bug]: "
labels: ["bug", "needs-triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug! 🙏

        Please fill out the form below to help us fix it faster.

  - type: checkboxes
    id: preflight
    attributes:
      label: Pre-flight checklist
      description: Please check the following before submitting
      options:
        - label: I have searched existing issues to make sure this bug hasn't been reported
          required: true
        - label: I am using the latest version of ClaudeCode.works
          required: true
        - label: I have read the [FAQ](https://claudecode.works/faq)
          required: false

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: A clear and concise description of the bug
      placeholder: "Example: The app crashes when I try to open a project with more than 1000 files"
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      description: How can we reproduce this behavior?
      placeholder: |
        1. Open ClaudeCode.works
        2. Click on '...'
        3. Type '...'
        4. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What did you expect to happen?
      placeholder: "Example: The app should open the project without crashing"
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened?
      placeholder: "Example: The app freezes for 5 seconds, then displays 'Application Error' and closes"
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      description: Which OS are you using?
      options:
        - macOS (Intel)
        - macOS (Apple Silicon)
        - Windows 10
        - Windows 11
        - Linux (specify in additional context)
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: ClaudeCode.works Version
      description: "Which version? (Found in: About → Version)"
      placeholder: "Example: v0.1.2"
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Error Logs
      description: |
        Please include relevant error logs.

        **macOS:** `~/Library/Logs/ClaudeCode.works/main.log`
        **Windows:** `%APPDATA%\ClaudeCode.works\logs\main.log`
      placeholder: Paste error logs here...
      render: shell

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots / Video
      description: If applicable, add screenshots or screen recordings
      placeholder: Drag and drop images/videos here

  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Any other context about the problem
      placeholder: |
        - Does this happen every time or intermittently?
        - Did this work in a previous version?
        - Any recent system changes?

  - type: checkboxes
    id: contribution
    attributes:
      label: Would you like to help fix this?
      description: We welcome contributions!
      options:
        - label: I'd be willing to submit a PR to fix this bug
          required: false
```

---

## feature_request.yml

```yaml
name: 💡 Feature Request
description: Suggest a new feature or enhancement
title: "[Feature]: "
labels: ["enhancement", "needs-triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting a feature! 🎉

        Your ideas help shape ClaudeCode.works!

  - type: checkboxes
    id: preflight
    attributes:
      label: Pre-flight checklist
      options:
        - label: I have searched existing feature requests to make sure this hasn't been suggested
          required: true
        - label: I have checked the [roadmap](https://github.com/YOUR_REPO/projects/1) to see if it's already planned
          required: true

  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: What problem does this feature solve?
      placeholder: |
        Example: "I often need to compare two different Claude responses side-by-side, but currently I can only view one conversation at a time."
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How would you like to see this implemented?
      placeholder: |
        Example: "Add a 'split view' mode that lets me open two conversations side by side, similar to how VSCode handles file comparisons."
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Have you considered any alternative solutions or workarounds?
      placeholder: |
        Example: "I currently copy-paste responses into a separate text editor for comparison, but it's tedious and loses formatting."

  - type: dropdown
    id: priority
    attributes:
      label: How important is this to you?
      options:
        - "Nice to have"
        - "Would improve my workflow significantly"
        - "Critical for my use case"
    validations:
      required: true

  - type: dropdown
    id: category
    attributes:
      label: Category
      description: What area does this feature relate to?
      options:
        - UI/UX
        - Chat/Conversation
        - Project Management
        - Performance
        - Security
        - Integration
        - Other
    validations:
      required: true

  - type: textarea
    id: examples
    attributes:
      label: Examples / Mockups
      description: Any examples from other apps or mockups you can share?
      placeholder: |
        Links to similar features in other apps, rough sketches, etc.

  - type: textarea
    id: use-case
    attributes:
      label: Use Case
      description: Describe a specific scenario where you'd use this feature
      placeholder: |
        Example: "When refactoring a large function, I ask Claude for two different approaches. I'd use split view to compare both responses and choose the best one."

  - type: checkboxes
    id: contribution
    attributes:
      label: Would you like to help implement this?
      options:
        - label: I'd be willing to submit a PR for this feature
          required: false
        - label: I can help with design/mockups
          required: false
        - label: I can help with testing/feedback
          required: false
```

---

## installation_issue.yml

```yaml
name: 📦 Installation Issue
description: Problems installing or running ClaudeCode.works
title: "[Install]: "
labels: ["installation", "needs-triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Having trouble installing or running ClaudeCode.works? Let us help! 🔧

  - type: checkboxes
    id: preflight
    attributes:
      label: Pre-flight checklist
      options:
        - label: I have read the [Installation Guide](https://claudecode.works/docs/installation)
          required: true
        - label: I have checked the [FAQ](https://claudecode.works/faq#installation)
          required: true

  - type: dropdown
    id: issue-type
    attributes:
      label: What's the issue?
      options:
        - "Can't download the installer"
        - "Can't open/install the app"
        - "App won't start after installation"
        - "macOS Gatekeeper blocking the app"
        - "Windows SmartScreen warning"
        - "Missing dependencies"
        - "Other (describe below)"
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      options:
        - macOS (Intel)
        - macOS (Apple Silicon)
        - Windows 10
        - Windows 11
        - Linux (unsupported)
    validations:
      required: true

  - type: input
    id: os-version
    attributes:
      label: OS Version
      description: "Example: macOS 14.1, Windows 11 23H2"
      placeholder: "OS version"
    validations:
      required: true

  - type: dropdown
    id: installer
    attributes:
      label: How did you download/install?
      options:
        - Direct download from claudecode.works
        - GitHub Releases
        - Homebrew (macOS)
        - Scoop (Windows)
        - Chocolatey (Windows)
        - Other
    validations:
      required: true

  - type: textarea
    id: error-message
    attributes:
      label: Error Message
      description: What error message do you see (if any)?
      placeholder: Paste the exact error message here...
      render: shell

  - type: textarea
    id: what-happened
    attributes:
      label: What Happened?
      description: Describe step-by-step what you did and what happened
      placeholder: |
        1. Downloaded ClaudeCode.works-0.1.0.dmg
        2. Opened the DMG
        3. Dragged to Applications
        4. Double-clicked the app
        5. Got error: "..."
    validations:
      required: true

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots
      description: Screenshots of the error or issue
      placeholder: Drag and drop images here

  - type: textarea
    id: context
    attributes:
      label: Additional Context
      placeholder: |
        - Antivirus software running?
        - Previous versions installed?
        - Admin/sudo access?
```

---

## question.yml

```yaml
name: ❓ Question
description: Ask a question about ClaudeCode.works
title: "[Question]: "
labels: ["question"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Have a question? We're here to help! 💙

        **Note:** For faster responses, consider asking in [Discord](https://discord.gg/YOUR_INVITE) instead.

  - type: checkboxes
    id: preflight
    attributes:
      label: Pre-flight checklist
      options:
        - label: I have checked the [Documentation](https://claudecode.works/docs)
          required: false
        - label: I have checked the [FAQ](https://claudecode.works/faq)
          required: false
        - label: I have searched existing issues/discussions
          required: false

  - type: textarea
    id: question
    attributes:
      label: Your Question
      description: What would you like to know?
      placeholder: "Example: How do I configure ClaudeCode.works to use a custom API endpoint?"
    validations:
      required: true

  - type: textarea
    id: context
    attributes:
      label: Context
      description: Any additional context that might help us answer
      placeholder: |
        - What are you trying to accomplish?
        - What have you tried so far?
        - Any relevant setup details?

  - type: dropdown
    id: category
    attributes:
      label: Category
      options:
        - General Usage
        - Configuration
        - Features
        - Troubleshooting
        - Development/Contributing
        - Other
```

---

## 💬 Saved Replies (For Maintainers)

Create these as saved replies in GitHub Settings → Saved replies

### 1. Thanks for Filing

```markdown
Thanks for filing this issue! 🙏

We've labeled it for triage. Someone from the team will take a look soon.

In the meantime:
- Make sure you're on the latest version
- Check our [FAQ](https://claudecode.works/faq) for common solutions
- Join our [Discord](https://discord.gg/YOUR_INVITE) for community support
```

### 2. Need More Info

```markdown
Thanks for the report! To help us investigate, could you provide:

- [ ] ClaudeCode.works version (Help → About)
- [ ] Operating system and version
- [ ] Error logs (see [how to find logs](https://claudecode.works/docs/troubleshooting#logs))
- [ ] Steps to reproduce

The more details you can share, the faster we can fix this! 🔍
```

### 3. Can't Reproduce

```markdown
Thanks for the report! I tried to reproduce this but couldn't get the same behavior.

Could you help by providing:

1. **Exact steps** to reproduce (starting from a fresh state)
2. **Screenshots or video** showing the issue
3. **Sample project** (if relevant) - can be a minimal example
4. **Any error messages** from the logs

This will help us track it down! 🔎
```

### 4. Duplicate Issue

```markdown
Thanks for filing! This looks like a duplicate of #[NUMBER].

I'm closing this in favor of the other issue to keep discussion in one place. Feel free to add any additional context there!

If you think this is different, please let me know and I'll reopen. 🙏
```

### 5. Working as Intended

```markdown
Thanks for the feedback! This behavior is actually intentional because [reason].

That said, I understand it's not intuitive. We're tracking UX improvements in #[NUMBER].

If you have suggestions on how to make this clearer, we'd love to hear them! 💡
```

### 6. Feature Request - Roadmap

```markdown
Great suggestion! 🎉

This is actually on our roadmap for [version/timeframe]. You can track progress here: [link to roadmap/project board]

If you'd like to help implement it:
- Check out our [Contributing Guide](CONTRIBUTING.md)
- Join the discussion in #[related-issue]
- Reach out on [Discord](https://discord.gg/YOUR_INVITE)

We'd love your contribution! 💙
```

### 7. Out of Scope

```markdown
Thanks for the suggestion!

While this is an interesting idea, it's outside the scope of ClaudeCode.works because [reason].

However, you might be interested in:
- [Alternative tool/approach]
- [Plugin system] (coming in v0.3) which might enable this

If you feel strongly about this, feel free to:
- Build it as a plugin when the system launches
- Fork the project and add it to your version (MIT license!)
```

### 8. Stale Issue

```markdown
This issue has been inactive for 60 days.

If this is still relevant:
- Please comment with an update
- Confirm you can still reproduce on the latest version
- Add any new information

Otherwise, we'll close this in 7 days to keep the issue tracker manageable.

Thanks! 🙏
```

### 9. Fixed - Please Test

```markdown
Good news! We believe this is fixed in v[X.X.X] 🎉

Could you:
1. Update to the latest version
2. Test if the issue is resolved
3. Let us know the result?

If it's fixed, we'll close this. If not, we'll investigate further!

Thanks for the report! 🙏
```

### 10. Security Issue - Private Channel

```markdown
Thanks for the report!

⚠️ This appears to be a security issue. Please **do not** discuss details publicly.

Instead, email security@claudecode.works with:
- Description of the vulnerability
- Steps to reproduce
- Your GitHub username (for credit)

We'll acknowledge within 48 hours and work with you on a fix.

I'm closing this issue to protect users. Thank you! 🔒
```

### 11. Great First Issue

```markdown
This would make a great first contribution! 🌟

I've labeled it `good first issue`. Here's how to get started:

1. Comment here if you want to work on it (to avoid duplicates)
2. Read our [Contributing Guide](CONTRIBUTING.md)
3. Ask questions in #development on [Discord](https://discord.gg/YOUR_INVITE)
4. Submit a PR when ready!

We're here to help if you get stuck. Happy coding! 💻
```

### 12. PR Welcome

```markdown
Great idea! We'd love a PR for this 🎉

Some pointers:
- [Relevant code location]
- [Any architectural considerations]
- Check out our [Contributing Guide](CONTRIBUTING.md)

If you're not sure how to implement it, feel free to:
- Open a draft PR for early feedback
- Ask in #development on [Discord](https://discord.gg/YOUR_INVITE)
- Request mentorship (we're happy to guide!)

Looking forward to your contribution! 💙
```

---

## 🎫 Pull Request Template

File: `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Description

<!-- Briefly describe what this PR does -->

Fixes #<!-- issue number -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Style/UI update (no functional changes)
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update

## Testing

<!-- Describe how you tested this -->

- [ ] I have tested this on macOS
- [ ] I have tested this on Windows
- [ ] I have tested this on Linux
- [ ] I have added/updated tests
- [ ] All existing tests pass

**Test steps:**
1.
2.
3.

## Screenshots / Video

<!-- If applicable, add screenshots or video demonstrating the change -->

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Additional Context

<!-- Add any other context about the PR here -->

## Breaking Changes

<!-- If this is a breaking change, describe what breaks and the migration path -->

---

**For Maintainers:**
- [ ] Milestone set
- [ ] Labels added
- [ ] Linked to relevant issue(s)
- [ ] Changelog entry added
```

---

## 🏷️ Label System

### Category Labels
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `question` - Further information is requested
- `installation` - Problems installing or running the app

### Priority Labels
- `priority: critical` - Blocks core functionality, needs immediate attention
- `priority: high` - Important to fix soon
- `priority: medium` - Should be fixed eventually
- `priority: low` - Nice to have

### Status Labels
- `needs-triage` - Needs initial review
- `needs-info` - Waiting for more information from reporter
- `needs-reproduction` - Can't reproduce, need more details
- `confirmed` - Bug confirmed, ready to be worked on
- `in-progress` - Someone is actively working on this
- `blocked` - Blocked by external dependency or other issue

### Difficulty Labels
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `advanced` - Requires deep knowledge of the codebase

### Platform Labels
- `macos` - macOS specific
- `windows` - Windows specific
- `linux` - Linux specific

### Area Labels
- `area: ui` - User interface
- `area: chat` - Chat/conversation functionality
- `area: project-management` - Project management features
- `area: performance` - Performance related
- `area: security` - Security related
- `area: api` - Claude API integration

---

## 🤖 Automation with GitHub Actions

File: `.github/workflows/issue-management.yml`

```yaml
name: Issue Management

on:
  issues:
    types: [opened, labeled]
  issue_comment:
    types: [created]

jobs:
  auto-label:
    runs-on: ubuntu-latest
    if: github.event.action == 'opened'
    steps:
      - name: Add needs-triage label
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.addLabels({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              labels: ['needs-triage']
            })

  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v8
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          stale-issue-message: 'This issue has been inactive for 60 days. Please update if still relevant, or we will close in 7 days.'
          close-issue-message: 'Closing due to inactivity. Feel free to reopen if this is still relevant!'
          days-before-stale: 60
          days-before-close: 7
          stale-issue-label: 'stale'
          exempt-issue-labels: 'pinned,security,roadmap'

  greet-first-time:
    runs-on: ubuntu-latest
    if: github.event.action == 'opened'
    steps:
      - name: Greet first-time contributors
        uses: actions/first-interaction@v1
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          issue-message: |
            Thanks for opening your first issue! 🎉

            Someone from the team will take a look soon. In the meantime:
            - Join our [Discord](https://discord.gg/YOUR_INVITE)
            - Check out the [Contributing Guide](CONTRIBUTING.md)
            - Star the repo if you haven't already ⭐
          pr-message: |
            Thanks for your first contribution! 🎉

            A maintainer will review your PR soon. Make sure:
            - All tests pass ✅
            - Code follows our style guide
            - Commits are clear and descriptive

            Welcome to the community! 💙
```

---

*All templates ready to use! Customize with your actual repository details.*
