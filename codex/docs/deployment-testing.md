# Deployment & Testing Quickstart

## Local Setup
1. Install dependencies (Node 20+ recommended):
   ```bash
   npm install
   ```
2. Run unit tests with Vitest:
   ```bash
   npm test
   ```
3. Optional watch mode during development:
   ```bash
   npm run test:watch
   ```
4. Type-check and emit build artifacts:
   ```bash
   npm run build
   ```

## Linting
```bash
npm run lint
```

## Vercel Deployment
1. Authenticate with Vercel and link the project:
   ```bash
   vercel login
   vercel link
   ```
2. Configure environment variables per environment (use `codex/scripts/bootstrapSecrets.ts` in CI):
   ```bash
   ts-node codex/scripts/bootstrapSecrets.ts production
   ```
3. Trigger deployment:
   ```bash
   vercel --prod
   ```

## Supabase Migration Workflow
1. Ensure Supabase CLI is installed and logged in.
2. Apply migrations locally:
   ```bash
   supabase db reset
   ```
3. Push schema to remote (staging/production):
   ```bash
   supabase db push --db-url "$SUPABASE_DB_URL"
   ```

## CI Recommendations
- Run `npm ci` followed by `npm test` and `npm run lint`.
- Use `vercel build` for preview deployment validation.
- Apply Supabase migrations in a controlled stage before production promotion.
