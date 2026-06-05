# DBeaver Connection Setup

## Connection Settings

Open DBeaver -> New Database Connection -> PostgreSQL

- Host: localhost
- Port: 5432
- Database: temple_trust_db
- Username: temple_admin
- Password: temple_trust_2025

Click "Test Connection" -> should show Connected -> Finish

## Verify Seeded Data

Run these in DBeaver SQL Editor after seeding:

```sql
SELECT id, name, receipt_prefix, donor_threshold FROM "Trust";
SELECT name, username, role, is_active FROM "User";
SELECT name, role, display_order FROM "Trustee";
```

Expected:

- 1 Trust row
- 2 User rows
- 1 Trustee row

## Useful Queries

```sql
-- Check all donations for this trust
SELECT receipt_number, donor_name, amount, payment_mode, donation_date
FROM "Donation"
WHERE trust_id = 'clsanwaliya001'
  AND is_deleted = false
ORDER BY created_at DESC;
```

## ER Diagram

Right-click public schema -> View Diagram

