# Contributing to GRIP Note

## Branching Model (NVIE / Gitflow)

```
master          <- production releases (merge from QA)
  └─ QA         <- release candidates, human acceptance testing (merge from develop)
      └─ develop <- integration branch, all features merge here
          ├─ claude/<feature>       <- Claude feature branches
          └─ fred.drury/<feature>   <- Fred feature branches
```

### Branch Rules

| Branch    | Purpose                          | Merges From | Merges To |
|-----------|----------------------------------|-------------|-----------|
| `master`  | Production releases              | QA          | —         |
| `QA`      | Release candidates, UAT          | develop     | master    |
| `develop` | Integration, feature collection  | feature/*   | QA        |
| `claude/*` or `fred.drury/*` | Feature work | develop | develop |

### Workflow

1. **Start a feature**: branch from `develop`
   ```bash
   git checkout develop
   git pull
   git checkout -b claude/my-new-feature
   ```

2. **Merge to develop**: when all tests + lint pass
   ```bash
   npm run lint
   npm test
   git checkout develop
   git merge claude/my-new-feature
   git push
   ```

3. **Release candidate**: merge `develop` into `QA`
   ```bash
   git checkout QA
   git merge develop
   git push
   ```

4. **Human acceptance testing** on the QA build

5. **Production release**: merge `QA` into `master`, tag the version
   ```bash
   git checkout master
   git merge QA
   git tag v1.x.x
   git push --tags
   ```

## Quality Gates

Before merging to `develop`:
- `npm run lint` — 0 errors (warnings OK)
- `npm run format:check` — all files formatted
- `npm test` — all tests pass
- `npm run test:coverage` — coverage thresholds met

## Running Checks Locally

```bash
npm run lint          # ESLint static analysis
npm run lint:fix      # Auto-fix ESLint issues
npm run format        # Format all files with Prettier
npm run format:check  # Check formatting without changing files
npm test              # Run all Jest tests
npm run test:coverage # Run tests with coverage enforcement
```
