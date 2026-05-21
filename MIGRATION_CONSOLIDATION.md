# Database Migration Consolidation & Multi-League Architecture

## Overview
This guide explains how to consolidate your 47+ migration files into a clean baseline and add multi-league + billing support.

---

## Step 1: Export Current Schema

### Using PowerShell (Windows)
```powershell
.\scripts\export-schema.ps1
```

### Using Bash (Linux/Mac/WSL)
```bash
bash scripts/export-schema.sh
```

This creates `schema_consolidated.sql` with your current database structure.

---

## Step 2: Archive Old Migrations

```powershell
# Create archive directory
mkdir migrations\archive

# Move all existing migrations
mv migrations\*.sql migrations\archive\

# Keep the migrations folder for new migrations
```

---

## Step 3: Create Baseline Migration

1. Review `schema_consolidated.sql`
2. Clean it up (remove auto-generated comments, format for readability)
3. Save as `migrations/001_baseline_schema.sql`
4. Add the migration tracking table from `migrations_new/000_migration_tracking.sql`

---

## Step 4: Apply New Multi-League Migrations

The new structure supports:

### Migration 002: Multi-League Support
- **leagues** - Each league is an independent organization
- **league_memberships** - Players can belong to multiple leagues
- All existing data gets assigned to a default "Paradise Golf" league
- Foreign keys added to: tournament, course, quota, skins_quota

### Migration 003: Billing & Subscriptions
- **subscription_plans** - Define pricing tiers (Free, Standard, Premium)
- **subscriptions** - Track each league's current subscription
- **payments** - Payment history and Stripe integration
- **invoices** - Invoice generation and tracking

---

## Database Schema Changes Summary

### New Tables Created
```
leagues
league_memberships
subscription_plans
subscriptions
payments
invoices
schema_migrations
```

### Modified Tables
```
leagues: +billing_email, +billing_name, +billing_address
tournament: +league_id (FK to leagues)
course: +league_id (FK to leagues)
quota: +league_id (FK to leagues)
skins_quota: +league_id (FK to leagues)
```

### Tables to Consider Adding league_id
```
settings - Each league could have its own settings
emails - Track which league sent each email
tournament_players - Already linked via tournament
scores - Already linked via tournament
```

---

## Multi-League Architecture

### Data Isolation
- Each league operates independently
- Players can be members of multiple leagues
- Tournaments, courses, quotas are league-specific
- Leaderboards filtered by league_id

### User Roles Per League
- **Owner**: Created the league, manages billing
- **Admin**: Can manage tournaments, players, settings
- **Member**: Can view/participate in tournaments

### League-Specific Features
```javascript
// Example: Get league context from request
const leagueId = req.user.currentLeagueId;

// All queries filtered by league
const tournaments = await pool.query(
  'SELECT * FROM tournament WHERE league_id = ?',
  [leagueId]
);
```

---

## Billing Integration

### Stripe Setup Required
1. Create Stripe account
2. Add API keys to environment:
   ```
   STRIPE_SECRET_KEY=sk_...
   STRIPE_PUBLISHABLE_KEY=pk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Subscription Plans
- **Free**: 20 players, 12 tournaments/year, basic features
- **Standard**: 50 players, unlimited tournaments, email notifications
- **Premium**: Unlimited players, SMS, branding, API access

### Payment Flow
1. User selects plan
2. Stripe Checkout session created
3. Webhook confirms payment
4. Subscription created/updated in database
5. Invoice generated

---

## Migration Execution Plan

### Development Environment
```powershell
# 1. Export current schema
.\scripts\export-schema.ps1

# 2. Create baseline
# Manually create migrations/001_baseline_schema.sql

# 3. Apply migration tracking
mysql -u root -p < migrations_new/000_migration_tracking.sql

# 4. Apply multi-league
mysql -u root -p < migrations_new/002_add_multi_league_support.sql

# 5. Apply billing
mysql -u root -p < migrations_new/003_add_billing_subscriptions.sql
```

### Production (Raspberry Pi)
```bash
# Backup first!
docker exec npgolf-mysql-pi mysqldump -u root -proot npgolf > backup_before_migration.sql

# Copy migrations to Pi
scp migrations_new/*.sql dalin@raspberrypi:~/npgolf/migrations_new/

# SSH to Pi and apply
ssh dalin@raspberrypi
cd ~/npgolf
docker exec -i npgolf-mysql-pi mysql -u root -proot npgolf < migrations_new/002_add_multi_league_support.sql
docker exec -i npgolf-mysql-pi mysql -u root -proot npgolf < migrations_new/003_add_billing_subscriptions.sql
```

---

## Code Changes Required

### 1. Add League Context Middleware
```javascript
// src/middleware/league-context.js
const addLeagueContext = async (req, res, next) => {
  if (req.user) {
    // Get current league from session or default
    const leagueId = req.session.currentLeagueId || req.user.defaultLeagueId;
    req.leagueId = leagueId;
  }
  next();
};
```

### 2. Update All Queries
Add `league_id` filters to queries:
```javascript
// Before
SELECT * FROM tournament WHERE date > ?

// After
SELECT * FROM tournament WHERE league_id = ? AND date > ?
```

### 3. League Selection UI
Add league switcher in header:
```javascript
// Frontend component
<LeagueSwitcher 
  leagues={userLeagues}
  currentLeague={currentLeague}
  onChange={handleLeagueChange}
/>
```

### 4. Subscription Checks
```javascript
// Middleware to check subscription limits
const checkSubscriptionLimits = async (req, res, next) => {
  const subscription = await getActiveSubscription(req.leagueId);
  const limits = subscription.plan.features;
  
  // Check player count, tournament count, etc.
  if (limits.max_players && playerCount >= limits.max_players) {
    return res.status(403).json({ 
      error: 'Player limit reached. Upgrade plan.' 
    });
  }
  next();
};
```

---

## Testing Checklist

- [ ] Export schema successfully
- [ ] Baseline migration applies cleanly
- [ ] Multi-league migration creates tables
- [ ] Default league created with existing data
- [ ] All players assigned to default league
- [ ] Billing migration creates subscription tables
- [ ] Free subscription created for default league
- [ ] Queries filtered by league_id work correctly
- [ ] League switching works in UI
- [ ] Subscription limits enforced
- [ ] Stripe integration functional

---

## Rollback Plan

If migration fails:
```bash
# Restore from backup
docker exec -i npgolf-mysql-pi mysql -u root -proot npgolf < backup_before_migration.sql

# Restart containers
docker-compose -f docker-compose-pi.yml restart
```

---

## Next Steps

1. **Run export-schema.ps1** to get current structure
2. **Review** the generated SQL
3. **Create** migrations/001_baseline_schema.sql
4. **Test** migrations in development first
5. **Update** application code for league context
6. **Add** Stripe integration
7. **Deploy** to production

---

## Questions to Answer Before Implementation

1. **League Isolation**: Should players' data (quota, stats) be shared across leagues or league-specific?
2. **Billing**: Will you handle billing yourself or use Stripe Billing/Subscriptions?
3. **Free Tier**: What limits for free tier?
4. **Data Migration**: Should existing Paradise Golf be on a paid plan?
5. **Multi-tenancy**: URL-based (league.npgolf.net) or path-based (npgolf.net/league-slug)?

---

## Resources

- **Stripe Subscriptions**: https://stripe.com/docs/billing/subscriptions/overview
- **Multi-tenancy Patterns**: https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/overview
- **MySQL Foreign Keys**: https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html
