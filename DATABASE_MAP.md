# Database Map

MySQL 8.0 database `npgolf`, running in the `npgolf-mysql` Docker container (host port 3308). The app reaches it through a `mysql2` pool (`src/db.js`) with raw SQL in `src/routes/*`. `schema.sql` is the current structure snapshot; refresh it with `scripts/export-schema.sh` after migrating.

Checked against the live database on 2026-11-14: 2 leagues, 48 players, 26 tournaments, 3,215 hole scores, 14.8 MB in total.

**Status:**
- Items 6 and 7 (integrity fixes, dead-weight cleanup) are done as migrations `058` and `059`, tested on a copy of the database.
- Item 1 is done as migrations `060` and `061`: **quota, FedEx points and prize money are all per league** (decided 2026-11-14).
- Items 2–5 are proposals, below.

---

## 1. Layout (after migrations 058–061: 29 tables + 1 view)

```
billing_entities ─┬─< players                (players.billing_entity_id)
                  ├─< billing_entity_roles >── players
                  ├─< course (created_by_entity_id)
                  └─< leagues ─┬─< league_players >── players   (membership + per-league quota_18/quota_9)
                               ├── league_settings (1:1)
                               ├─< league_rulesets
                               ├─< league_player_stats >── players   (unused; see §3.1)
                               ├─< quota / skins_quota (league_id)
                               ├─< league_seasons ─┬─< season_player_stats >── players
                               │                   └─< tournament (season_id)
                               └─< tournament (league_id NOT NULL, ON DELETE RESTRICT)

course ─┬─< hole ─< hole_tee >─ course_tee
        └─< tournament

tournament ─┬─< tournament_players >─ players, course_tee
            ├─< scores >─ players, hole
            ├─< foursome_posts
            ├─< tournament_paradise_points    (regular-season FedEx points)
            ├─< tournament_skin_winners / tournament_ctp_winners
            ├─< tournament_payouts            (prize money per player: quota / skins / ctp)
            ├─< tournament_playoff_points
            ├─< tournament_results_email
            └── tournament_completion_backups (no FK, on purpose)

emails, schema_migrations  (standalone)
```

| Area | Tables |
|---|---|
| Identity & tenancy | `players`, `billing_entities`, `billing_entity_roles`, `leagues`, `league_players`, `league_player_stats` |
| League config | `league_settings` (fees, quota points table, live scoring, playoff format), `league_rulesets`, `league_seasons` |
| Courses | `course`, `hole`, `course_tee`, `hole_tee` |
| Tournaments | `tournament`, `tournament_players`, `scores`, `foursome_posts` |
| Results | `tournament_paradise_points`, `tournament_skin_winners`, `tournament_ctp_winners`, `tournament_playoff_points`, `season_player_stats`, `tournament_results_email`, `tournament_completion_backups` |
| Quota | `quota` (7 rolling slots), `skins_quota` (20 slots) |
| Side games (migration 064) | `league_side_game_defaults`, `tournament_side_games`, `tournament_side_game_entries` (opt-in), `tournament_side_game_teams` (saved Blind Draw), `tournament_side_game_results`; prize money goes to `tournament_payouts` as `side_games` |
| Other | `emails`, `schema_migrations` |

---

## 2. Done: items 6 and 7

### `058_drop_dead_weight.sql`
- **Dropped 11 tables that no code reads or writes:**
  - Legacy: `users`, `tournament_pairings`, `league_settings_old`, `global_settings`.
  - Billing scaffolding: `subscription_plans`, `subscriptions`, `payments`, `invoices`, `billing_entity_settings`.
  - Events: `events`, `event_participants`.
- **Removed `tournament.event_id`** and its CHECK constraint. `tournament.league_id` is now NOT NULL.

### `059_integrity_fixes.sql`
- **One collation everywhere** (`utf8mb4_0900_ai_ci`). Before this, the 10 remaining tables still on `utf8mb4_unicode_ci` were converted.
- **Deleting a league is blocked** while it has tournaments. The FK on `tournament.league_id` changed from CASCADE to RESTRICT, which matches the API's existing guard.
- **New FKs on `league_seasons`:** the champion, tiebreak and losers-winner player columns now reference `players` (ON DELETE SET NULL).
- **`foursome_posts.posted_by` is now nullable with ON DELETE SET NULL.** Deleting a player used to fail with an FK error once they had posted a foursome.
- **`tournament_results_email`** now uses INT UNSIGNED IDs and has an FK to `tournament` (ON DELETE CASCADE).
- **`emails.message_id` is UNIQUE.**
- **Dropped 22 indexes** that duplicated another index's leading column or indexed an on/off flag.

### Code changes
- `src/routes/scores.js`: foursome post status uses LEFT JOIN, so a post whose poster was deleted still shows as posted.
- `src/email-poller.js`: the insert no longer throws if two polls store the same message.

### Repo cleanup
- **Removed:**
  - Migration leftovers: `migrations/002_*_old.sql`, `migrations/rollback_002.sql`, `migrations_new/`, `apply_migrations.sql`.
  - Stale snapshot: `schema_consolidated_from_pi.sql`.
  - The four root `*_course_insert.sql` files, which migration 056 already covers.
  - The duplicate runner `scripts/run-migrations.js` (`npm run migrate` uses `scripts/migrate.js`).
  - `MIGRATION_CONSOLIDATION.md`.
- `schema.sql` was regenerated from the migrated schema.
- `scripts/export-schema.*` now writes `schema.sql`.

**Tested:** a full copy of the live DB ran `npm run migrate` twice (the second run checks that re-running is safe). All 28 tables and their row counts survived. All 76 Jest tests pass, and the app served the tournaments, leaderboard, courses and rules endpoints against the migrated copy.

---

## 3. Proposed: items 1–5

### 3.1 A player in two leagues: everything is kept per league

**Decision (2026-11-14):** quota, FedEx points and prize money are all kept separately for each league. Quota is per league because each league awards different quota points per hole (`league_settings.quota_points_*`), so a shared quota would mix two scales.

#### Done: per-league quota (`060_per_league_quota.sql` + code)
- **Current quota** lives on the membership row: `league_players.quota_18 / quota_9`, one row per player per league. Login, the player list, tournament rosters, the leaderboard, tournament completion, backup and restore, and quota refresh and history all read and write the current league's row.
- **Quota history** (`quota`, `skins_quota`) is `UNIQUE(player_id, league_id)`, and every lookup filters by league. Before this, lookups took the player's first row regardless of league.
- **Recording scores in a league's tournament makes you a member of that league.** The bulk foursome assignment and "add to foursome" screens could already put any player into any tournament. Completion and those two screens now add the league membership. Today nobody has scores in a league they don't belong to, so the migration adds no members. (Five Paradise players were invited to the Farley event on 2026-06-21 but answered "no" and didn't play; they stay Paradise-only.)
- Fixed in passing: saving a quota history row for a player with no history row failed, because the insert didn't set `league_id`.

#### Done: per-league FedEx points and prize money (`061_per_league_points_and_prizes.sql` + code)
- **`tournament_payouts`** stores what each player won in each tournament, split into quota, skins and CTP. `src/payouts.js` calculates it from **that tournament's league fees**. It runs on completion, on backup restore, when the results email is regenerated, and when a league's player list loads (paid flags and winners can change after completion).
- **The quota pot now follows the leaderboard's rule:** `quota_collected` when it's set, otherwise paid players × the league fee. The 50/30/20 split and tie handling are unchanged.
- **`league_player_totals`** (view) gives FedEx points, tournaments played and prize money per league and player, always calculated from the per-tournament results.
- **The player list, the edit-player response and both results-email paths** read from the view for the current league.
- **Removed:** the two global prize calculators (one always used league 1's fees, the other used one league's fees for every tournament) and the global FedEx update.
- **The edit-player form** shows the three totals read-only, because they're calculated now. Manual edits were already overwritten by the next recalculation.

**What changes for players (checked on a copy):**
- FedEx points: every player's per-league totals add up exactly to their old number.
- Prize money changes for 6 players:
  - Farley, 2026-06-21, was priced with Paradise's $10 fee instead of Farley's $15. Jim Meyers goes $36 → $48, Vic Balcarcel $24 → $32, Pat Ambs $44 → $64.
  - Paradise, 2026-07-29, collected $50, but the old totals assumed $60. Mitchell Gawronski goes $335 → $332, Greg Gleason $258 → $256, Shaun Fusari $267 → $262.
- **After this, each tournament's leaderboard and the season totals agree.**

**Tested** on a copy of the database:
- Migrations 058–061 ran twice.
- All existing memberships kept their quota.
- 76/76 tests pass and the frontend builds.
- Completing an open Paradise tournament updated only Paradise quotas, history, points and payouts ($64 quota, $39 skins, $26 CTP), and the results email was generated.
- Editing a player's Farley quota left Paradise alone.
- Restoring the completion backup put quotas, history, points and payouts back exactly.

#### Still to do
- **A cleanup migration, once production runs the new code:** drop `players.quota_18/quota_9`, `players.fedex_points/tournaments_played/prize_money` and the unused `league_player_stats`. Nothing reads or writes them anymore.
- FedEx points and prize money are all-time totals per league, as before. Per-season totals are a filter on `tournament.season_id` if you want them on the dashboard.

### 3.2 One identity per person (email)

Players are rows per billing entity, and `league_players` handles membership within one entity. A person in leagues under two entities therefore has **two rows**. Today that's you (Commish #10 / Eric #56) and Maria Ortiz Garcia (#15 / #57). With two rows, password reset (`WHERE email = ? LIMIT 1`) can pick the wrong row, and the person has two logins. Quota no longer depends on this: it's per league either way (§3.1).

**Options:**
- **A. One global player per person (recommended).**
  - Merge the duplicate rows: re-point `tournament_players`, `scores`, the results tables and memberships to one id.
  - Add a lowercase generated column `email_normalized` with `UNIQUE`, and make login and reset use it.
  - Membership in an entity becomes `billing_entity_roles` only; drop `players.billing_entity_id`.
  - One login per person, and an admin sees one record for them in every league they play in.
- **B. Keep a row per entity and add a `person_id`.** Login moves to a `people` table. More tables and joins for the same result.
- **C. `UNIQUE(billing_entity_id, email)` only.** Stops the reset ambiguity within an entity, but the person keeps a separate login per entity.

### 3.3 Quota history as rows instead of numbered columns

Replace `quota` (28 slot columns) and `skins_quota` (60) with:

```sql
CREATE TABLE quota_round (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id     INT UNSIGNED NOT NULL,
  league_id     INT UNSIGNED NOT NULL,      -- quota is per league
  tournament_id INT UNSIGNED NULL,          -- NULL for manually entered history
  kind          ENUM('quota','skins') NOT NULL,
  played_on     DATE NOT NULL,
  holes         TINYINT UNSIGNED NOT NULL,  -- 9 or 18
  points        INT NOT NULL,
  quota_diff    INT NULL,
  UNIQUE KEY uq_round (player_id, league_id, kind, tournament_id),
  KEY idx_recent (player_id, league_id, kind, played_on),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE SET NULL
);
```

- **Reading:** the rolling window becomes `ORDER BY played_on DESC LIMIT 7` (or 20). The window size moves into `league_settings` instead of the schema.
- **Editing:** fixing or deleting a past round no longer means shifting columns.
- **Migration:** backfill by unpivoting `date_N/points_N/quota_diff_N/holes_N`, compare quotas before and after, then drop the old tables.
- **Code:** the changes are in `tournaments.js` (completion history update, backup and restore) and `users.js` (refresh-quotas and the quota history endpoints), all of which are already league-scoped.

### 3.4 Remove duplicated data

| Duplication | Proposal |
|---|---|
| `players.role` and `billing_entity_roles.role` | Keep per-entity roles in `billing_entity_roles` and reduce `players` to an `is_super_admin` flag. Goes naturally with §3.2 A |
| Foursome label in `tournament_players.foursome`, `scores.foursome_group` (on every hole) and `foursome_posts.foursome_group` | New `tournament_foursomes(id, tournament_id, label, starting_hole, tee_time, posted_at, posted_by)`. `tournament_players` gets `foursome_id`, and `scores.foursome_group` and `foursome_posts` go away. About 28 code references, mostly `scores.js` and `cart-tags.js` |
| `tournament.in_progress` / `completed` | **Never read or written by any code, and 0 for all 26 tournaments.** Completion is inferred from whether `tournament_paradise_points` exist. Either drop both, or replace them with `status ENUM('scheduled','in_progress','completed')` and set it on completion (recommended, because the leaderboard query gets simpler) |
| `hole_number` in skin/CTP winner tables | Drop it and join `hole` |

Correction to the earlier list: `scores.quota` is **not** a copy of the player's quota. It holds the quota points earned on that hole. Keep it, as a snapshot of that league's points table, but rename it `quota_points` for clarity.

### 3.5 Move CTP photos out of the database

The 2 stored CTP photos (base64 PNGs) take **7.0 MB in `scores` + 0.8 MB in `tournament_ctp_winners`, about half of the 14.8 MB database.**

**Proposal:**
- Save uploads as files on a Docker volume (for example `/data/ctp/<tournament>/<hole>-<player>.jpg`), resized to about 1600 px JPEG.
- Add `ctp_photos(id, tournament_id, hole_id, player_id, kind ENUM('ctp','foursome_ctp'), file_path, bytes, created_at)`.
- Serve the photos through an authenticated route.
- A one-time script decodes the existing data URIs to files.
- Then drop `scores.ctp_image_url`, `scores.foursome_ctp_image_url` and `tournament_ctp_winners.ctp_image_url`.

Backups shrink, and every `SELECT *` on `scores` gets lighter on the Pi.

---

## 4. Suggested order for items 1–5

1. After deploying 058–061: the cleanup migration that drops the unused `players` stat and quota columns and `league_player_stats`.
2. Decide §3.2 (one global player), then merge the 2 duplicate people.
3. §3.3: quota history as rows (per league).
4. §3.5: CTP photos to files.
5. §3.4: foursomes table, tournament status, role cleanup.

Each step is its own migration plus code change, tested the same way as 058–061: clone the DB into `npgolf_mtest`, run `npm run migrate` twice, run the tests, and smoke-test the app against the copy.
