# Code Formatting

This project uses [Prettier](https://prettier.io/) for consistent code formatting across both frontend and backend codebases.

## Configuration

Both `frontend` and `backend` directories have their own Prettier configuration:

- **Backend** (`.prettierrc`): Standard TypeScript/Node.js settings
- **Frontend** (`.prettierrc`): React-friendly settings with JSX single quotes

### Common Settings

- **Semi**: Always include semicolons
- **Single Quotes**: Use single quotes for strings
- **Trailing Commas**: ES5-compatible trailing commas
- **Print Width**: 100 characters max
- **Tab Width**: 2 spaces
- **Arrow Parens**: Avoid parentheses when possible
- **End of Line**: LF (Unix-style)

## Commands

### Root Level (formats both projects)

```bash
# Format all files in both frontend and backend
npm run format

# Check formatting without making changes
npm run format:check
```

### Frontend Only

```bash
cd frontend

# Format all files
npm run format

# Format only src/ directory
npm run format:src

# Check formatting without making changes
npm run format:check
```

### Backend Only

```bash
cd backend

# Format all files
npm run format

# Format only src/ directory
npm run format:src

# Check formatting without making changes
npm run format:check
```

## Ignored Files

The following files and directories are ignored by Prettier:

- `node_modules/`
- `dist/` and `build/` (build outputs)
- `.env` files
- Database files (`*.db`, `*.sqlite`, `drizzle/`)
- Log files (`*.log`)
- Cache directories (`.vite/`, `.turbo/`)
- Generated files (`*.d.ts`)

## Editor Integration

### VS Code

Install the [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and add this to your workspace settings:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

### Other Editors

Prettier has plugins for most popular editors. See the [official documentation](https://prettier.io/docs/en/editors.html) for setup instructions.

## Pre-commit Hooks (Optional)

You can set up pre-commit hooks to automatically format code before commits:

```bash
# Install husky for git hooks
npm install --save-dev husky lint-staged

# Add to package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write", "git add"]
  }
}
```

## Continuous Integration

The formatting check is included in the CI pipeline. All PRs must pass the formatting check before being merged.

To check formatting in CI:

```bash
npm run format:check
```

This command will exit with a non-zero code if any files are not properly formatted. 