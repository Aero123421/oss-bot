# CI

GitHub Actions workflow template: [`ci.github-actions.yml`](./ci.github-actions.yml).

Copy into the repo (needs `workflow` scope on the pushing token):

```bash
mkdir -p .github/workflows
cp docs/ci.github-actions.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml && git commit -m "ci: add SQLite stack workflow"
```

Stack: Node 22 / SQLite / no Postgres / no Redis. Runs `npm run build`, `npm run doctor:ci`, then Docker build.
