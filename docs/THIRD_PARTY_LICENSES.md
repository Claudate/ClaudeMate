# Third-Party Licenses

ClaudeCode.works uses various open-source libraries and components. We're grateful to these projects and their contributors.

This document lists all third-party dependencies and their licenses.

**Last Updated:** [Date]

---

## How to Use This Document

**For Users:**
- This shows what open-source software powers ClaudeCode.works
- All licenses are OSI-approved and compatible with our MIT license

**For Developers:**
- Review before adding new dependencies
- Ensure license compatibility
- Update this file when dependencies change

---

## License Summary

| License | Count | Commercial Use | Modification | Distribution |
|---------|-------|----------------|--------------|--------------|
| MIT | ~XX | ✅ | ✅ | ✅ |
| Apache 2.0 | ~XX | ✅ | ✅ | ✅ |
| BSD-2-Clause | ~XX | ✅ | ✅ | ✅ |
| BSD-3-Clause | ~XX | ✅ | ✅ | ✅ |
| ISC | ~XX | ✅ | ✅ | ✅ |

**All licenses are permissive and allow commercial use.**

---

## Core Dependencies

### Electron

**Purpose:** Cross-platform desktop application framework
**License:** MIT
**Copyright:** GitHub Inc. and Electron contributors
**Website:** https://www.electronjs.org/
**Repository:** https://github.com/electron/electron

```
MIT License

Copyright (c) Electron contributors
Copyright (c) 2013-2020 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

### React

**Purpose:** UI component library
**License:** MIT
**Copyright:** Meta Platforms, Inc. and affiliates
**Website:** https://react.dev/
**Repository:** https://github.com/facebook/react

```
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

---

### TypeScript

**Purpose:** Type-safe JavaScript
**License:** Apache 2.0
**Copyright:** Microsoft Corporation
**Website:** https://www.typescriptlang.org/
**Repository:** https://github.com/microsoft/TypeScript

```
Apache License 2.0

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License...
```

---

## Development Dependencies

### Webpack

**Purpose:** Module bundler
**License:** MIT
**Repository:** https://github.com/webpack/webpack

### Babel

**Purpose:** JavaScript compiler
**License:** MIT
**Repository:** https://github.com/babel/babel

### ESLint

**Purpose:** JavaScript linting
**License:** MIT
**Repository:** https://github.com/eslint/eslint

### Prettier

**Purpose:** Code formatting
**License:** MIT
**Repository:** https://github.com/prettier/prettier

### Jest

**Purpose:** Testing framework
**License:** MIT
**Repository:** https://github.com/facebook/jest

---

## UI/UX Dependencies

### Monaco Editor

**Purpose:** Code editor (VSCode's editor)
**License:** MIT
**Copyright:** Microsoft Corporation
**Repository:** https://github.com/microsoft/monaco-editor

```
MIT License

Copyright (c) 2018 Microsoft Corporation

Permission is hereby granted, free of charge...
```

---

### Tailwind CSS

**Purpose:** Utility-first CSS framework
**License:** MIT
**Repository:** https://github.com/tailwindlabs/tailwindcss

```
MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted...
```

---

### Heroicons

**Purpose:** Icon set
**License:** MIT
**Copyright:** Tailwind Labs, Inc.
**Repository:** https://github.com/tailwindlabs/heroicons

---

## Utility Libraries

### Lodash

**Purpose:** Utility functions
**License:** MIT
**Repository:** https://github.com/lodash/lodash

### Day.js

**Purpose:** Date manipulation
**License:** MIT
**Repository:** https://github.com/iamkun/dayjs

### Axios

**Purpose:** HTTP client
**License:** MIT
**Repository:** https://github.com/axios/axios

### Marked

**Purpose:** Markdown parser
**License:** MIT
**Repository:** https://github.com/markedjs/marked

---

## Electron-Specific Dependencies

### electron-builder

**Purpose:** Package and distribute Electron apps
**License:** MIT
**Repository:** https://github.com/electron-userland/electron-builder

### electron-updater

**Purpose:** Auto-update functionality
**License:** MIT
**Repository:** https://github.com/electron-userland/electron-builder

### electron-store

**Purpose:** Persistent data storage
**License:** MIT
**Repository:** https://github.com/sindresorhus/electron-store

```
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>

Permission is hereby granted...
```

---

## State Management

### Zustand

**Purpose:** State management
**License:** MIT
**Repository:** https://github.com/pmndrs/zustand

```
MIT License

Copyright (c) 2019 Paul Henschel

Permission is hereby granted...
```

---

## Security & Monitoring (Optional)

### Sentry (SDK)

**Purpose:** Error tracking (opt-in only)
**License:** BSD-3-Clause
**Repository:** https://github.com/getsentry/sentry-javascript

```
BSD 3-Clause License

Copyright (c) 2019 Functional Software, Inc. dba Sentry

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that...
```

**Note:** Sentry SDK is MIT, but the Sentry service has its own terms.

---

## Performance Optimization

### react-window

**Purpose:** Windowing/virtualization for large lists
**License:** MIT
**Repository:** https://github.com/bvaughn/react-window

---

## Testing

### @testing-library/react

**Purpose:** React testing utilities
**License:** MIT
**Repository:** https://github.com/testing-library/react-testing-library

### Playwright

**Purpose:** End-to-end testing
**License:** Apache 2.0
**Repository:** https://github.com/microsoft/playwright

---

## Build & Tooling

### Vite (if used)

**Purpose:** Fast build tool
**License:** MIT
**Repository:** https://github.com/vitejs/vite

### PostCSS

**Purpose:** CSS transformation
**License:** MIT
**Repository:** https://github.com/postcss/postcss

---

## Full Dependency List

**To generate the complete list:**

```bash
# In your project directory
npm install -g license-checker
license-checker --summary

# Or for detailed output
license-checker --csv > licenses.csv
```

**This will include all transitive dependencies.**

---

## Embedded Resources

### Fonts

**If you embed any fonts:**

#### JetBrains Mono (example)

**Purpose:** Monospace font for code
**License:** OFL (SIL Open Font License)
**Website:** https://www.jetbrains.com/lp/mono/

```
SIL Open Font License 1.1

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: http://scripts.sil.org/OFL
```

---

### Icons/Graphics

**If you use icon sets or graphics:**

List them here with attributions.

---

## License Compatibility

All dependencies use licenses compatible with our MIT license:

**Compatible Licenses:**
- ✅ MIT
- ✅ Apache 2.0
- ✅ BSD (2-Clause, 3-Clause)
- ✅ ISC
- ✅ CC0 (Public Domain)
- ✅ OFL (for fonts)

**Incompatible Licenses (we avoid):**
- ❌ GPL / LGPL (copyleft - conflicts with MIT)
- ❌ AGPL
- ❌ Proprietary licenses

---

## How We Manage Licenses

### Review Process

Before adding a new dependency:
1. Check license compatibility
2. Review for security vulnerabilities
3. Evaluate maintenance status
4. Update this file

### Automated Checks

We use tools to ensure compliance:
- `license-checker` (npm package)
- Dependabot (GitHub)
- npm audit
- Manual review for major dependencies

### Updating This File

**When dependencies change:**
1. Run `npm run generate-licenses` (if you set this up)
2. Review new licenses
3. Update this document
4. Commit changes

---

## Attribution Requirements

Some licenses require attribution in the distributed software.

**We fulfill this by:**
- Including this THIRD_PARTY_LICENSES.md file
- Displaying "About → Open Source Licenses" in the app
- Including LICENSE files from dependencies in our distribution

---

## Acknowledgments

We're grateful to all open-source contributors who make ClaudeCode.works possible.

**Special thanks to:**
- Electron team for the amazing framework
- React team for the UI library
- Microsoft for TypeScript and Monaco Editor
- All other library maintainers

**Without open source, ClaudeCode.works wouldn't exist.** 💙

---

## Disclaimer

This file is provided for informational purposes.

**For the most accurate license information:**
- Check the original project repositories
- Review LICENSE files in node_modules
- Run `license-checker` for your specific installation

**We make best efforts to maintain accuracy**, but:
- Dependencies update frequently
- Licenses may change
- Transitive dependencies add complexity

---

## Reporting License Issues

**Found a license issue?**

Email: legal@claudecode.works
GitHub: Open an issue with "license" label

**We take license compliance seriously** and will address issues promptly.

---

## License Notices in Application

### In the App

Users can view licenses at:
**Help → About → Open Source Licenses**

This displays:
- All dependencies
- Their licenses
- Copyright notices
- Links to projects

### In Distributions

Our installers include:
- This THIRD_PARTY_LICENSES.md file
- LICENSE files from bundled dependencies
- Proper copyright notices

---

## Open Source Philosophy

**We believe in open source.**

ClaudeCode.works is MIT licensed because:
- We want wide adoption
- We respect developer freedom
- We value community contributions
- We stand on shoulders of giants

**By using permissive licenses throughout:**
- Anyone can use, modify, distribute
- Commercial use is encouraged
- No copyleft restrictions
- Maximum freedom for users

---

## Contributing

**When contributing to ClaudeCode.works:**

If you add a dependency:
1. Ensure it's a permissive license
2. Add it to this document
3. Include proper attribution
4. Run license checker

If you contribute code:
- Your contribution is MIT licensed
- You retain copyright
- You grant us rights to use and distribute

**See CONTRIBUTING.md for details.**

---

## Resources

**Learn more about open source licenses:**

- Choose a License: https://choosealicense.com/
- SPDX License List: https://spdx.org/licenses/
- OSI Approved Licenses: https://opensource.org/licenses
- TLDRLegal: https://tldrlegal.com/ (plain English explanations)

---

## Automated Generation

**To auto-generate this list:**

```bash
# Install license-checker
npm install -g license-checker

# Generate summary
license-checker --summary

# Generate detailed Markdown
license-checker --markdown > LICENSES.md

# Generate CSV
license-checker --csv > licenses.csv

# Check for specific licenses
license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"
```

**Note:** You may need to manually format output for this document.

---

## Version History

**v1.0 - [Date]**
- Initial version
- Listed core dependencies
- Electron, React, TypeScript, etc.

**Updates:**
- Add new entries when dependencies change
- Remove entries when dependencies are removed
- Update versions quarterly

---

## Contact

**Questions about licenses?**

Email: legal@claudecode.works
GitHub: https://github.com/YOUR_REPO/issues

---

*This document is part of ClaudeCode.works, an MIT-licensed open-source project.*
*Thank you to all open-source contributors! 🙏*

---

**Last Updated:** [Date]
**ClaudeCode.works Version:** [Version]
**Total Dependencies:** ~[Number] (including transitive)
