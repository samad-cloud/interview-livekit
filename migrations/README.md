# Database Migrations

SQL migration scripts for the Supabase database.

## How to Run

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Open the migration file, copy contents
5. Paste into SQL Editor and click **Run**

## Migration Order

Run migrations in numerical order:

| # | File | Description | Status |
|---|------|-------------|--------|
| 001 | `001_enhance_jobs_table.sql` | Add Job_Input_Document fields | ⏳ Pending |

## Naming Convention

```
{number}_{description}.sql
```

- `number`: 3-digit sequential (001, 002, etc.)
- `description`: snake_case summary

## After Running

Update the status in this README from ⏳ Pending to ✅ Done.
