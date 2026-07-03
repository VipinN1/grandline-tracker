# PirateTracker Web App — Full Feature Inventory

This document is an exhaustive, page-by-page inventory of every feature in the **web app** (`src/`), written to check feature parity against the **mobile app** (`mobile/`). It covers every route, button, form, business rule, and Supabase table touched. Use it as a checklist: for each section, verify the mobile app has an equivalent (or note it as intentionally deferred).

Generated 2026-07-03 by reading every file in `src/pages`, `src/components`, `src/hooks`, `src/lib`.

---

## Cross-Cutting Patterns (apply across many pages — check these first)

- **Admin identity is a single hardcoded username check: `profile.username === 'Cipin'`.** There is no `is_admin`/role column. This exact string check gates: Bug Reports page access, Marketplace/Storefront admin approval, tournament-list creation (`TournamentsPage`), and the Friends page's tournament-admin-grant feature. Mobile must replicate the same check everywhere (or the team should centralize/replace it with a real role field — flagged as tech debt either way).
- **Card image URL fallback chain** (used almost everywhere a card image renders): try a custom `photo_url` upload first → on error fall back to `https://optcgapi.com/media/static/Card_Images/{card_id}.jpg` → on second error hide/placeholder. `src/lib/optcgapi.js`'s `getCardImageUrl()` is the canonical non-proxied version; `TournamentShareCard.jsx` uses a special CORS-safe proxy (`/api/card-image?id=`) because it needs to canvas-export images.
- **Practice tournaments are excluded from all stats.** `tournaments.is_practice = true` rows are saved to history and shown in the History tab, but are filtered out of Dashboard stats, Profile stats, Stats page matchup matrix, and Bounty Board — everywhere else. Only History/Leaders-tab-adjacent lists show them (tagged with a "Practice" badge).
- **Friendship is stored as directional rows in `friends` (`user_id, friend_id, status`), not a single mutual row.** Sending a request inserts one `pending` row. Accepting updates that row to `accepted` **and** inserts a second mirrored row (the reverse direction) so both users' own-row queries see the friendship. Removing a friend deletes all matching rows in either direction. This exact dual-row model is used identically in `UserProfilePage.jsx`, `ProfilePopover.jsx`, and `Friends.jsx` — must be replicated exactly or mobile/web friend graphs will diverge.
- **Two-step "confirm to delete" UI pattern**: first click turns a Delete button into "Confirm?" for ~3 seconds (auto-reverts via timeout), second click within that window performs the actual delete. Used for: decklists, posts (Community), marketplace listings/wants, tournament logs. Some deletes (BugReports, storefront inventory item "Remove") skip this and delete immediately or use a simpler two-button confirm.
- **Decklist paste-parsing format**: lines matching `^(\d+)[xX]([A-Z0-9\-]+)$` (e.g. `4xOP01-024`), one card per line; malformed lines are silently skipped. A `Leader: <ID>` line (case-insensitive "leader") is recognized in DeckBuilder's import specifically. Parsed cards get enriched (name/color/type/image) via `enrichCards()` from the card API.
- **Leader/opponent search-as-you-type autocomplete** pattern: 350–400ms debounce, minimum 2 characters, calls `searchLeaders(query)` (leader-only) or `searchCards(query)` (all types), capped at 50 results for leader search / 250 for general card search, dropdown shows thumbnail + name + color + set ID, closes on outside click or selection.
- **Dice/Going/Result toggle groups** (used in LogResult, LiveTournament rounds): tri-state — clicking the already-selected pill deselects it back to `null`/unset. Not simple binary radios.
- **`cleanName(name)` helper** (reimplemented per-file, same regex logic): strips a trailing card-set-code suffix (`" - OP01-001"` style) and a trailing parenthetical (`"(Parallel)"` style) from leader/card names for clean display. Used in Dashboard charts, Stats matrix, BountyBoard, TournamentModal share card, TournamentShareCard.
- **Base-card-ID grouping** (`baseId()`/regex against `card_set_id`/`card_image_id`): used specifically in `Stats.jsx` to merge alt-art/parallel variants of the same leader into one matchup row. Dashboard's leader-usage chart does **not** do this merge (groups by exact `leader_id`) — an intentional inconsistency between the two pages to preserve as-is.
- **Supabase Storage bucket `card-photos`** is reused for many unrelated upload types via different path prefixes: marketplace listing photos (`{user_id}/{timestamp}.{ext}`), want photos (same pattern), storefront logos (`store-logos/{storefront.id}.{ext}` or `store-logos/apply-{user_id}-{timestamp}.{ext}`), DM image attachments (`dm/{user_id}/{uuid}.{ext}`). Avatars use a **separate** bucket, `avatars`, at path `{user_id}/avatar.{ext}`.
- **Win rate formula everywhere**: `wins / (wins + losses)` — no ties/draws handling anywhere in the codebase.
- **`useWindowSize()` hook**: `isMobile` = width < 768, `isTablet` = width < 1024 (note: isTablet is true for phone widths too — it's not an exclusive range). RN equivalent: `useWindowDimensions` + same breakpoints.
- **Realtime via Supabase channels**, one dedicated channel per concern, named with the user/entity ID baked in (e.g. `navbar_dm_{userId}`, `sim_tournament_{id}`, `listing-messages-{listingId}`), always unsubscribed in a cleanup effect keyed on the relevant ID/session changing.

---

## Site Map / Navigation (source of truth: `src/components/Navbar.jsx`)

**Signed-in desktop nav, in order:** Dashboard · Stats · Log Result · Decklists · Friends · Profile · ☠ Bounty · Community · Tournaments · Market · Deck Builder · About · (admin only) Bug Reports

**Signed-out desktop nav:** Deck Builder · ☠ Bounty · Community · Tournaments · Market · About, plus Log In / Sign Up buttons.

**Mobile nav**: hamburger slide-out menu with the same link sets, plus a "📷 Scan Card" entry (opens the CardScanner overlay) pinned at the top, and Sign Out pinned at the bottom.

**Global chrome elements present on every page:**
- PirateTracker wordmark/compass logo (links to `/`).
- 🐞 "Bug" button (always visible, even logged out) → opens `BugReportModal`.
- Avatar (image or initials) in top-right, links nowhere directly (menu/profile access elsewhere).
- Two independent unread-message badges (red pill, "9+" cap): one for `marketplace_messages` (shown on "Market" link), one for `direct_messages` (shown on "Community" link) — both live via Realtime subscriptions.
- `FloatingCards` decorative background: 16 (desktop) / 8 (tablet) / 4 (mobile) faint, slowly drifting random card images behind all content, purely ambient, no interaction.

**Full route table:**
| Route | Page | Auth |
|---|---|---|
| `/` | Home (marketing) or redirect to `/dashboard` if logged in | public |
| `/login` | Login | public (redirects away if session) |
| `/signup` | Signup | public |
| `/reset-password` | ResetPassword | public |
| `/deck-builder` | DeckBuilder | public (save requires login) |
| `/live` | LiveTournament | public (guest mode is ephemeral) |
| `/community` | Community | public (posting/DMs require login) |
| `/marketplace` | Marketplace | public (messaging/selling requires login) |
| `/dashboard` | Dashboard | protected |
| `/stats` | Stats | protected |
| `/log` | LogResult | protected |
| `/decklists` | Decklists | protected |
| `/friends` | Friends | protected |
| `/profile` | Profile (own) | protected |
| `/profile/:userId` | UserProfilePage (others') | public, redirects to `/profile` if viewing self |
| `/tournaments` | TournamentsPage (sim tournament list) | public |
| `/tournaments/:id` | TournamentDetailPage | public |
| `/storefront/:id` | StorefrontPage | public |
| `/bounty` | BountyBoard | public |
| `/bug-reports` | BugReports | protected + admin-only |
| `/about` | About | public |

---

## 1. Public / Marketing Pages

### Home (`/`)
- Hero: "Chart Your Course Through the Grand Line", "Free — no account required" callout.
- 4 feature cards with CTA buttons: Deck Builder → `/deck-builder`, Track Your Tournaments → `/log`, Community → `/community`, Marketplace → `/marketplace`.
- Bottom auth CTA panel: "Unlock everything with a free account" (Tournament history · Saved decklists · Post in Community · Message sellers · Friends & profiles) with Sign Up / Log In buttons.
- Purely static/navigational — no data fetching.

### About (`/about`)
- "What is this?" description.
- "What you can do" — 6 feature blurbs: Deck Builder, Tournaments, Bounty Board, Marketplace, Community, Card Scanner.
- "Who we are" — 2 named crew members (Vipin "Original Creator", Weston "Co-Developer") with initials-avatar cards.
- Credits: attribution to OPTCG API / DomoBot, legal disclaimer (unofficial, One Piece IP belongs to Bandai/Oda).

### Login (`/login`)
- Email + password fields, submit on Enter.
- "Sign In" → `supabase.auth.signInWithPassword`. Raw Supabase error shown inline on failure.
- "Forgot password?" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/reset-password' })`, requires email filled first, shows "Password reset email sent" confirmation (does not auto-hide). Mobile needs an equivalent deep-link/URL-scheme redirect instead of `window.location.origin`.
- "Sign up" link → `/signup`. No OAuth/social login, no biometrics, no "remember me".

### Signup (`/signup`)
- Fields: Username* (≥3 chars), Email*, Password* (no client-side strength/length check), Location (optional).
- `supabase.auth.signUp({ email, password, options: { data: { username, location } } })` — username/location go into auth user_metadata at signup.
- Success → "Check your email" screen with confirmation-link messaging.
- No password-confirmation field (unlike ResetPassword, which has one).

### ResetPassword (`/reset-password`)
- New Password + Confirm Password fields; password must be ≥6 chars and match.
- `supabase.auth.updateUser({ password })` → success message, auto-navigate to `/dashboard` after 2s.
- Relies on Supabase already having a recovery session from the emailed magic link (mobile needs equivalent deep-link handling for the recovery token).

---

## 2. Dashboard (`/dashboard`) — protected

Authenticated home/at-a-glance summary. Excludes practice tournaments from all stats.

- Data: `tournaments` for the user, joined with `decklists(*)` and `tournament_rounds(*)`, ordered by date desc.
- **4 stat tiles**: Win Rate (%), Tournaments (count + "N top 8" sub-label), Best Finish (ordinal, min placement), Record (W–L).
- Empty state (0 events): "No data yet" + link to `/log`.
- **Charts (must be ported to an RN chart lib, e.g. react-native-svg + expo-linear-gradient — web uses Recharts):**
  - **Placement Trend** line chart — x=date, y=placement (reversed axis, #1 on top), needs ≥2 events, dot colored gold(1st)/orange(≤3)/ocean(≤8)/faint. Tooltip: date, "Nth of N players", tournament name.
  - **Leader Usage** donut chart — top 6 leaders by count, custom SVG gradient fills for dual-color leaders (splits "Color1/Color2" and computes gradient angle), percentage labels hidden if <8% share, side legend list. Groups by exact `leader_id` (no base-ID merge, unlike Stats page).
  - **Win Rate by Leader** — horizontal bar/progress list, top 3 leaders shown by default with a "▼ Show all (N)" expand toggle.
- **Recent Results list** (top 5 ranked tournaments) — each row clickable → `TournamentModal`; shows placement badge, name, date, player count, location, leader mini-thumbnail (desktop), W/L counts. "+ Log Result" button → `/log`.
- Loading state: skeleton placeholders.

---

## 3. Stats (`/stats`) — protected

Detailed "your leaders vs opponent leaders" matchup win-rate matrix.

- **Scope toggle**: Mine (your `user_id` only) vs Global (all users). In Global scope, every round is counted from **both perspectives** (mirrored/symmetric) — doubles sample size and pulls in every leader anyone has ever played.
- **Metric toggle**: Overall / Going 1st / Going 2nd / Won Dice / Lost Dice.
- Independent search boxes for row leaders ("yours") and column leaders ("opponents").
- **Matrix construction**: leaders grouped by **base card ID** (regex strips variant/parallel suffixes — the one page that does this merge), only `win`/`loss` results count (ties/incomplete excluded), rows/columns sorted by total games desc.
- Table: sticky header + sticky first column, cell = win rate % + W-L record (monospace), cells with <3 games faded to 40% opacity (not hidden), cell background interpolates crimson→emerald centered at 50% win rate, hover tooltip shows full matchup + record.
- Empty states distinguish "not enough matchup data" vs "no leaders match your search" (with Clear search button).

---

## 4. Log Result (`/log`) — protected

Primary data-entry hub. Two entry modes via `ModeToggle`:

### Mode A: Live Tournament (see section 12 below — same component as the standalone live-tournament flow)

### Mode B: Past Tournament Form (`PastTournamentForm`)
- **Tournament Info**: Store/Venue (`SearchableSelect` against `stores` table, inline "+ Create store" by typing "name, city, state"), Tournament Series (`SearchableSelect` against `tournament_series`, inline creation, auto-disables/fills Tournament Name if a series is chosen), Date* (required), Players (optional number), Final Placement* (required number), **"Mark as Practice" toggle** (explicit UI copy: excluded from win rate/bounty/all stats).
- **Rounds**: live running W/L counter; each round has Opponent's Leader search (debounced autocomplete), Dice Roll toggle (Won/Lost, nullable), Going toggle (1st/2nd, nullable), Result toggle (Win/Loss, nullable — but required at submit), Notes textarea, remove-round ✕. "+ Add Round" button.
- **Decklist**: either "Attach Decklist From Account" (opens `SelectDecklistModal`) OR manual paste (Deck Name + textarea, parsed via the `4xOP01-024` regex, "Preview Decklist" button enriches and shows thumbnails + text list) — mutually exclusive in UI.
- **Notes** (tournament-level freeform).
- **Leader Card panel** (sticky sidebar desktop / top card mobile): leader search or selected-leader display with image/name/color/ID/Power/Life (desktop).
- **Validation**: name-or-series, date, placement, leader, and every round having a result — all required, inline error banner per failure.
- **Submit logic**:
  - If cards were manually parsed (no attached account decklist), first inserts a new `decklists` row.
  - `location` field on the tournament is a **flattened string snapshot** of the store (not a live FK — editing a store later won't retroactively change old logged locations).
  - `wins`/`losses` are **computed from the rounds array**, not manually entered.
  - **Editing** an existing tournament: updates the tournament row, then **deletes all existing `tournament_rounds` and re-inserts the full array fresh** (rounds are always wholesale-replaced on edit, never diffed).
  - Navigates to `/profile` after edit, `/dashboard` after new creation.
- Supports an **edit mode** entered via router state `{ editTournament }` (passed from Profile's `TournamentModal` "Edit" action) — skips the mode toggle, goes straight into the past-tournament form pre-filled.

---

## 5. Live Tournament (`/live`, and the "Live Tournament" mode inside `/log`)

Run/log an in-person tournament round-by-round in real time, then archive to permanent history.

- On mount (logged in), resumes any existing `active`-status row in `live_tournaments` for the user. Guests always start fresh (no persistence).
- **SetupScreen**: Store/Venue + Tournament Series autocomplete (same patterns as PastTournamentForm), Tournament Name (required if no series), Date (defaults today), Player Count (optional), Deck Name (optional, defaults to "{leader} Deck"), Your Leader (required, autocomplete).
  - **Guest (no session)**: creates an in-memory-only tournament with synthetic id `guest-{timestamp}` — nothing persists if the tab/app closes.
  - **Logged in**: inserts into `live_tournaments` with `status: 'active'`.
- **RoundLogger**: per-round Opponent's Leader search, Dice Roll toggle, Going toggle, Result toggle (required), Notes. **Draft autosaved to localStorage** (`live_round_draft_{tournamentId}`) on every keystroke so a reload mid-entry doesn't lose data; cleared once all fields empty. Round number = `rounds.length + 1`.
  - Guest: appends in-memory only. Logged in: inserts into `live_rounds`.
- **RoundHistory**: read-only list of logged rounds so far.
- **ActiveTournament** main view: live stats strip (Record, Win Rate, 1st WR, 2nd WR — a computed "dice win %" stat exists in code but is NOT displayed here, only surfaces later in the share card), **Cancel** (native confirm, deletes all `live_rounds` + the `live_tournaments` row if logged in), **Finish** (opens confirm modal).
- **Overall Tournament Notes** — separate freeform textarea, separately autosaved to localStorage (`live_overall_notes_{tournamentId}`).
- **Finish flow**: requires Final Placement (integer). On confirm: inserts a permanent row into `tournaments` + bulk-inserts `tournament_rounds` from the live rounds, marks the `live_tournaments` row `status: 'finished'`, clears localStorage drafts.
  - **Guest**: shows congratulatory summary + "sign up to save" nudge — **results are never persisted** for guests, ever.
- **Gotcha**: an abandoned/cancelled live tournament leaves zero trace in permanent history by design — only "Finish" transfers data.

---

## 6. Decklists (`/decklists`) — protected

Grid of the user's saved decklists.

- Search bar filters client-side by deck name or leader name.
- "+ New Decklist" → `/deck-builder`.
- Grid of `LeaderCard` tiles: leader header image (falls back to colored placeholder + name text on image error), colored accent bar, two-click-confirm delete (✕ → "Confirm?" 3s auto-revert), deck name + leader name/ID + "Updated {date}".
- Clicking a card opens `DeckModal`: leader banner, "All Cards (N)" flat image grid (one image per physical copy), grouped list by type (Character/Event/Stage/Other), clicking any card opens `CardPreview` full-screen. **"Copy Decklist" button exists but has no handler wired — non-functional placeholder**, do not assume it needs replicating unless product wants it built for real.

---

## 7. Deck Builder (`/deck-builder`)

Full deck construction tool. Public route, but saving requires login (redirects to `/login`).

- **Leader selection**: debounced autocomplete search, selected leader shown as a card with border colored per `COLORS` map (Red/Blue/Green/Purple/Yellow/Black), ✕ to clear.
- **Card search & filters**: debounced search, filter pills for Color (multi-select), Type (Leader/Character/Event/Stage), Source (booster-set dropdown OP01–OP16/EB01–EB04/PRB01–02, or Starter Decks `^ST`, or Promos `^P-`), Alt Art (Parallel/SP/Manga/TR, heuristic regex-based detection), Cost (0–10 pill buttons).
- Search results as a thumbnail grid; hover shows a floating preview panel (desktop only); clicking adds to deck. Visual states: highlighted border + count badge if in deck, "MAX" overlay at 4 copies, disabled once deck total = 50.
- **Deck panel** (sticky sidebar): `N / 50` progress bar (turns green at 50), Clear button (no confirmation), List/Visual view toggle.
  - **List view**: grouped by type, +/− steppers per card.
  - **Visual view**: thumbnail grid, left-click = +1, right-click = −1 (needs a touch equivalent like long-press on mobile).
  - **Rules enforced**: max 4 copies per unique `card_set_id`, max 50 cards total.
- **Deck name** input.
- **Export**: copies a plain-text list to clipboard (`Leader: <id>` line + `<count>x<id>` lines), shows "Copied!" for 2s.
- **Import modal**: paste textarea, parses `Leader: <ID>` line and `<count>xID` lines (regex, no spaces around the "x"), **replaces the whole deck** (does not merge with existing), clamps each import to 4 copies but does **not** enforce the 50-card cap on import.
- **Save Deck**: validates name + leader present, redirects to login if signed out, inserts into `decklists`, navigates to `/decklists`.
- Gotcha: cards are keyed by `card_set_id` not `card_image_id`, so different art variants of the same set ID collapse into one deck entry.

---

## 8. Friends (`/friends`) — protected

- **Load**: accepted friends (`friends` where `user_id=me, status=accepted`, joined profiles), pending incoming requests (`friend_id=me, status=pending`), own username (for admin check).
- **Search bar**: filters only your already-loaded friends list (not global user search).
- **Add friend bar**: exact-username lookup + "Send Request" — errors: "User not found", "You can't add yourself", "Request already sent or you are already friends" (on unique-constraint failure). Inserts a `pending` row.
- **Tabs**: "Friends" and "Requests (N)" (badge count).
- **Friends tab**: grid of friend cards (avatar, username, location), click → `ProfilePopover`.
- **Requests tab**: each row has **Accept** (updates row to accepted + inserts reciprocal accepted row — the dual-row pattern) and **Decline** (hard delete, no undo, no notification to requester).
- **Admin-only** 🛡 shield button per friend card (visible only if `username === 'Cipin'`) → opens a modal to **grant/revoke per-tournament admin access** for that friend: lists "Your Tournaments" (`sim_tournaments` where `created_by = me`) with toggle switches; ON inserts into `sim_tournament_admins`, OFF deletes the row.

---

## 9. Profile (`/profile`, own) — protected, and UserProfilePage (`/profile/:userId`, others')

### Own Profile
- **Avatar upload**: tap avatar → file picker → uploads to Storage bucket `avatars` at `{userId}/avatar.{ext}` (`upsert: true`), public URL cache-busted with `?t={timestamp}`, updates `profiles.avatar_url`.
- **Header card**: avatar, username, pronouns, location + "Since {Month Year}", badges (1st Place gold if best finish is 1st, "N Events" always, "Top 8 ×N" if any, mobile-only "X% WR"), "Edit Profile" button → `EditProfileModal` (Username*, Pronouns, Bio — updates both `profiles` table AND `auth.updateUser` user_metadata username).
- **Bio box**, **stats row** (Tournaments/Top 8s/Best Finish/**Fav. Leader shown as a card image thumbnail**, the only stat tile that swaps text for an image).
- **Tabs**: "Tournament History" (shows ALL tournaments including practice, tagged with a "Practice" pill; stats above are still ranked-only) / "Leaders Played" (grid of every unique leader played from ranked-only set, each with played-tournament sublist) + "Export CSV" button (**no onClick handler wired — non-functional placeholder**, do not build unless requested).
- Clicking any tournament row opens `TournamentModal` with `onEdit` (→ `/log` with router state `{editTournament}`) and `onDelete`.

### UserProfilePage (viewing someone else)
- Same header/bio/stats/tabs structure but read-only (no Edit Profile, no avatar upload, no Export CSV). Fav. Leader shown as **text** here (last word of cleaned leader name) instead of an image — an intentional inconsistency vs. own Profile.
- **Friend status button**: derived from the `friends` OR-query (either direction) — accepted→"Remove Friend" (red), pending_sent→disabled "Request Sent", pending_received→"Accept Request" (green), none→"+ Add Friend" (blue). Hidden if logged out.
- **"💬 Message" button** → `navigate('/community', { state: { dmUserId: profile.id } })` — hands off to Community's Messages tab to auto-open that thread. This exact navigation contract must exist on mobile.
- Redirects to `/profile` if `userId === session.user.id` (viewing yourself through this route bounces to the real own-profile page).
- Not-found state if profile doesn't exist.

### ProfilePopover (shared component, opened from many places: Friends grid, Community post/comment authors, DM thread headers, tournament participant lists)
- Lightweight modal/bottom-sheet: avatar, username, location, bio (truncated 120 chars), 3-stat mini grid (Win Rate/Events/Top 8s), same friend-button logic as UserProfilePage, "View Full Profile →" button.

---

## 10. Community (`/community`)

Feed of user posts with likes/comments/replies, plus a Messages tab hosting DirectMessages.

- **Tabs** (shown if logged in): "Posts" / "Messages" (with unread-DM badge). Deep-link support: navigating here with router state `{dmUserId}` auto-switches to Messages and opens that thread.
- **Filter toggle**: "latest" (by created_at) vs "top" (by likes).
- **Create Post** (logged in) → `CreatePostModal`: Title, Body, optional decklist attach (from-account picker OR manual leader-search + paste-parse, same pattern as LogResult).
- **PostCard**: author (click → popover), date, two-step-confirm delete (own posts only), body truncated at 180 chars with more/less toggle, attached decklist shown via collapsible `DeckPanel` (card image grid, click → full-screen `CardPreview`).
  - **Like**: toggles a `post_likes` row + calls `increment_post_likes`/`decrement_post_likes` RPC (denormalized counter column on `posts`, not a live count). Redirects to login if signed out.
  - **Comments**: top-level comments load eagerly on mount (not lazily on expand); comment composer (logged in only); replies nest to a UI-enforced max depth of 2 (button hidden past that, not DB-enforced); comment likes mirror post likes via separate `comment_likes` table + RPCs.
- **Gotcha**: creating a post triggers a full post-list refetch rather than an optimistic prepend.

---

## 11. Direct Messages (embedded in Community's Messages tab, `src/components/DirectMessages.jsx`)

- **Conversation list**: derived client-side from all `direct_messages` rows involving the user (no separate `conversations` table) — grouped by other-user, most-recent message as preview, unread count per thread. Preview text falls back to "📷 Photo" or "🃏 Decklist" if no text body.
- **Thread panel**: text messages, image attachments (upload to `card-photos/dm/{userId}/{uuid}.{ext}`), decklist attachments (pick via `SelectDecklistModal`, rendered collapsible with card-image grid), auto-scroll to bottom, Enter-to-send / Shift+Enter newline.
- **Read tracking**: opening a thread bulk-marks all its unread messages read; a new realtime message arriving while that thread is already open is marked read immediately (different code path than the bulk-on-open one).
- **Realtime**: channel `dm_inbox_{userId}`, INSERT events append to the open thread (if it matches) and always refresh the conversation list/unread counts.
- Mobile layout: list and thread are mutually exclusive full-screen views on phone width, with a back arrow.

---

## 12. Sim Tournaments — `TournamentsPage` (`/tournaments`) + `TournamentDetailPage` (`/tournaments/:id`)

This is the Discord-run, structured Swiss-tournament system — a **separate concept** from the "Live Tournament"/`tournaments` history table (section 5). Do not conflate the two "tournament" systems in the rebuild.

### TournamentsPage (list)
- Card list, ordered newest first, each showing status badge (Registration Open/Reg. Closed/In Progress/Completed), description, player count, deadline, Discord-linked badge, current-round badge if active.
- **Admin-only** (`username === 'Cipin'`) "+ Create Tournament" → modal: Name*, Description, Discord Link, Registration Deadline* (`datetime-local`, explicitly converted from naive-local to UTC ISO via `toISOString()` — **critical to replicate exactly**, a naive port will misinterpret timezones).

### TournamentDetailPage (the core engine)
- **Per-tournament admin** = tournament creator OR a row in `sim_tournament_admins` (separate concept from the global `'Cipin'` admin used only on the list page for creation gating).
- **Join/Drop**: Join inserts into `sim_tournament_players` during open registration. Drop (self or admin-on-other) sets `dropped: true`; if the dropped player has a pending/disputed match in the current round it's **auto-forfeited** as a loss. Dropped players keep their record in standings (dimmed) but are excluded from future pairings.
- **Decklist submission**: leader-search + paste textarea, saved to `sim_tournament_players.decklist` JSON, `decklist_submitted: true`. **Hidden from all other players until tournament status is `completed`** — but this is UI-only gating (the tab just doesn't render pre-completion); not enforced server-side.
- **Swiss pairing algorithm** (`generatePairings`): shuffles standings, sorts by wins desc, then:
  - Even players: exhaustive backtracking search (`bestMatching`) minimizing rematches, capped at 200,000 search nodes as a safety limit, early-exits on a 0-rematch solution.
  - Odd players: one bye assigned to the player with fewest historical byes (tie-broken by lowest standing), rest paired via the same matching algorithm.
- **Standings** (`computeStandings`): wins, losses, and **OWR (opponent win rate)** = mean of each opponent's individual win rate; sorted by wins desc then OWR desc.
- **Round lifecycle**: admin clicks "Start Round N" (disabled below 2 active players) → marks current round completed, generates next pairings, inserts `sim_rounds` + `sim_matches` rows (bye auto-completes immediately).
- **Match reporting**: each participant submits "I Won"/"I Lost" independently (writes `player1_reported`/`player2_reported`). `resolveIfReady` re-checks the match server-side once both sides report: matching win/loss → auto-completes; conflicting reports → `status: 'disputed'`. **A reconciliation sweep re-runs `resolveIfReady` on every realtime match-list reload** (safety net for clients that dropped connection mid-resolution) — mobile must replicate this sweep or matches can get stuck pending.
- **Admin dispute resolution**: force-set a winner on any pending or disputed match directly (bypasses the report-matching logic).
- **Winner declaration**: auto-suggested when exactly one undefeated player remains after a completed round (one-click "Declare Winner"); if 0 or 2+ undefeated, admin manually force-ends via a standings modal.
- **Delete Tournament** (admin): cascading manual delete across matches → rounds → players → admins → tournament row, in that order (no DB cascade relied on).
- **Per-match chat** (`MatchChat`): collapsible widget per match card, visible only to the two participants + any admin (admins see every match's chat for dispute investigation), used mainly to exchange room/match codes. Realtime delivery handled by the parent page's subscription, not internally.
- **Tabs**: Pairings (current round), Standings, History (all rounds), Decklists (completed tournaments only).
- **Realtime**: single channel per tournament covering `sim_matches`, `sim_tournament_players`, `sim_rounds`, `sim_tournaments`, `sim_match_messages`.
- **Winner overlay**: full-screen celebratory overlay auto-shown when the tournament is completed and has a winner.

---

## 13. Marketplace (`/marketplace`)

Four tabs: Browse, Looking For, Stores, My Listings.

### Browse (sell listings, `marketplace_listings`)
- Filter bar: text search, Color, Condition (5 values: Near Mint/Lightly Played/Moderately Played/Heavily Played/Damaged), Min/Max price, City.
- Grid of `ListingCard`s, client-side "Load more" pagination (50 at a time — **entire active list is fetched upfront**, not server-paged).
- Detail modal: full info + seller popover + **"Mark as Sold"** (owner, soft status update) or **"Message Seller"** (opens per-listing `MessageModal`, realtime, marks-read-on-open).
- **Create Listing** (2-step wizard): Step 1 card search (with extensive filter pills: Color max-2, Type, Source, Alt Art, Cost) OR manual-entry fallback (Name*, ID optional, Color, Type, Set Name — gets synthetic ID `CUSTOM-{timestamp}` if blank). Step 2: Price* (>0), Quantity, Condition*, Description (500-char cap), City (pre-filled from profile location), optional Photo upload.
- **Edit Listing**: card identity locked, everything else editable including photo removal.
- **My Listings**: own listings (all statuses) with Edit/Mark Sold/Delete (two-step confirm, hard delete), per-listing unread-message badge, embedded **Wants** section and **Inbox** section.

### Looking For / Wants (`marketplace_wants`) — "I want to buy this card"
- Same browse/filter/pagination/detail-modal pattern as Browse, but for buy-requests instead of sell-listings.
- `CreateWantModal`: card search (no manual-entry fallback), optional custom title (80 char cap), optional photo, Quantity*, optional Max Price, optional Notes (300 char cap).
- Non-owner sees "I Have This!" button → `WantMessageModal` (separate `want_messages` table, same realtime/read pattern as listing messages).
- Owner's "My Wants" section: Mark Found (status→'found') and two-step-confirm Delete.

### Inbox (`InboxSection`, embedded in My Listings)
- Aggregates all `marketplace_messages` for the user into conversations grouped by `(listing_id, other_user_id)`, shows latest-message preview + unread badge per thread, clicking opens the scoped `MessageModal`.

### Stores tab
- **Admin-only** pending-applications panel (view/approve/reject storefront applications).
- Public directory grid of approved storefronts (logo, name, address, live inventory count) → `/storefront/{id}`.
- **My Storefront** section: apply flow (`ApplyStorefrontModal` — Logo, Store Name*, Address, Contact Info, Website) or status display (pending/approved-with-"Manage Store"-link/rejected).

---

## 14. Storefront Page (`/storefront/:id`)

Single store's public page + owner management console + admin approval.

- **Admin approval bar** (visible to admin, non-approved stores only): Approve / Reject buttons.
- **Owner controls**: Edit Store Profile (`EditStoreModal`), toggle between "Manage Inventory" (manager view) and "View Store" (public view) — **same route, client-side toggle**, not separate URLs.
- **Manager view**: inventory list with Edit/Remove (soft-delete → `status: 'sold'`) per row, "+ Add Card" (`AddInventoryModal`, same 2-step card-search pattern as Marketplace listings but with unlimited multi-color filter, unlike Marketplace's 2-color cap), **Bulk Import via CSV** (`CsvImportModal`).
- **CSV import format** (critical for parity): header columns `card_id,quantity,price,condition` (case-insensitive), naive comma-split (no quoted-field handling), condition values validated against the exact 5 allowed strings (case-sensitive — a bad value aborts the whole parse with a row-numbered error). Import runs sequentially with a progress bar; per-row card lookup falls back to the first search result if no exact ID match (a known data-quality gotcha — can attach the wrong `card_name`/color/type to a row while keeping the correct raw ID).
- **Public browse view**: filter bar (text/Color/Type/Condition/Min-Max price), grid of `InventoryCard`s — no detail modal, no per-card contact button (messaging is store-wide only, not per-item).
- **Store messaging** (`StoreMessageModal`): thread scoped per `(storefront_id, buyer_id)` — **gap noted by the research agent: there is no owner-side inbox UI to see/reply to buyer threads anywhere in this page**, unlike Marketplace's `InboxSection`. Flag this to Fable 5 as either a known gap to leave as-is or an opportunity to add on mobile.

---

## 15. Bounty Board (`/bounty`)

Read-only community leaderboard — **zero write operations**, purely derived from the `tournaments` table.

- **Bounty formula** (must be reimplemented identically, it's pure client-side math, not a stored value): `max(0, wins×100,000 − losses×50,000 + placementBonus)`. Placement bonus: 1st=฿1,000,000, 2nd=฿500,000, 3rd=฿300,000, 4th=฿200,000, 5th–8th=฿100,000, 9th–16th=฿50,000, below=฿0. Currency symbol is ฿ (Thai Baht sign as a "Belly" stand-in); values ≥1B render as `฿X.XXB`.
- Header stats: pirates tracked, tournaments logged, your rank (if signed in and ranked).
- **3 analytics cards**: "Meta — Last 30 Days" (leader play-count bar chart, calendar 30-day window), "Top Leaders by Win Rate" (min 3 tournament-appearances threshold to qualify, avoids small-sample distortion), "Recent Results" (last 8 tournaments, click → `/profile/{userId}`).
- **Bounty Rankings** leaderboard: all players ranked by cumulative bounty, 🥇🥈🥉 for top 3, "YOU" highlight for the current user's row, click any row → `/profile/{userId}`.

---

## 16. Bug Reports

### BugReportModal (`src/components/BugReportModal.jsx`) — global, always available
- Single free-text textarea (no title/category/severity fields), works **fully logged out**.
- Auto-captures `window.location.pathname` as the `page` field (mobile needs an equivalent "current screen name" concept) and resolves username (profile DB lookup preferred over auth user_metadata).
- Inserts into `bug_reports`: `message, user_id (nullable), username, page`.
- Success screen: "Thanks for the report! ... PirateTracker ..." (app is referred to as "PirateTracker" in this copy).

### BugReports page (`/bug-reports`) — admin-only (`username === 'Cipin'`)
- Non-admins (including other logged-in users) see a "Not authorized" lock screen.
- Filter tabs: Open/Resolved/All (client-side, `status ?? 'open'` default for legacy null-status rows).
- Each report: status pill, reporter link → `/profile/{userId}` (or "Anonymous" if no user_id), page path (monospace), timestamp, full message, **Mark Resolved/Reopen** toggle, **Delete** (no confirmation, unlike most other deletes in the app).

---

## 17. Card Scanner (`src/components/CardScanner.jsx`)

Full-screen live-camera OCR scanner, opened from the mobile nav's "📷 Scan Card" entry (lazy-loaded to keep Tesseract.js out of the main bundle). **The most complex single feature in the app** — flagged as possibly deferred on mobile per the existing project memory, but documented here in full for whenever it's tackled.

- Rear camera via `getUserMedia`, torch/flashlight toggle if supported, framing guide overlay (5:7 card aspect box with a "number band" marked in the bottom 45%).
- **Burst-scan**: shutter press captures 5 frames over ~650ms (130ms apart) without blocking further shots; each burst appears immediately in a bottom filmstrip with a pending spinner.
- Per frame, 3 crops are produced: number-band (bottom 45%, grayscale+contrast), corner crop (bottom-right ~50%×11%, the primary OCR source), and full raw card crop (name-search fallback). A focus/sharpness score ranks frames.
- **Two-stage vote-based resolution**: Stage 1 OCRs the corner crop of the top-2 sharpest frames + the number-band of the single sharpest, tallies candidate card-IDs by weighted vote, tries top 4 against `getCardVariants()` (memoized per session so scanning 4 copies of the same card costs one network call). Stage 2 fallback: OCR the full raw crop, or fall back further to a name-based `searchCards()` lookup.
- **OCR text cleanup / prefix-correction** (`extractCardIds`/`snapPrefix`): normalizes separator glyphs, then "snaps" a garbled prefix to the nearest known valid set-prefix using a digit/letter OCR-confusion table (O↔0, I↔1, S↔5, B↔8, etc.) — corrects common misreads and rejects garbage before wasting an API call.
- Manual override: a variant `<select>` dropdown per resolved snap (Base/SP/TR/Manga/Alt art) lets the user correct an auto-pick.
- "Done (N)" closes the scanner; N = successfully identified snaps.
- **Mobile porting note**: this needs either a native OCR pipeline (ML Kit/Vision) or a bundled OCR lib, plus equivalent canvas-crop-percentage math — not a trivial 1:1 port, per the existing project memory ("tesseract.js won't run in RN — cloud OCR or defer").

---

## 18. Tournament Result Modal & Share Card

### TournamentModal (`src/components/TournamentModal.jsx`)
Read-only viewer for a completed permanent-history tournament (opened from Dashboard/Profile/UserProfilePage rows). Shows placement badge, round stats (1st/2nd/Dice win rates), round-by-round list, attached decklist (card grid + text list, click → `CardPreview`), notes, optional Edit/Delete (callback-driven, parent decides behavior).

### Share flow (`ShareOverlay`, inside TournamentModal) + standalone `TournamentShareCard.jsx`
- Renders a shareable "screenshot card": leader portrait with W-L overlay, tournament title/date/players, placement badge, W/L + win rate, a large auto-shrinking "ghosted" watermark of the leader's cleaned name (font-size shrink loop down to a 30px floor — needs an RN equivalent measurement approach), round-by-round mini table, and a 3-column stats footer (Going 1st/2nd %, Dice Won %).
- Uses a CORS-safe **image proxy** (`/api/card-image?id=`) specifically so canvas-based screenshot capture doesn't taint — RN equivalent would use `react-native-view-shot` and likely doesn't need the proxy trick (no canvas taint issue), but needs a hidden/offscreen capture strategy.
- Close button is deliberately placed **outside** the visually-cropped "screenshot zone" so it doesn't get captured accidentally.

---

## 19. Supporting Library Behavior (`src/lib/optcgapi.js`, `src/lib/supabase.js`)

- **`supabase.js`**: standard Supabase client via Vite env vars. Mobile equivalent needs `AsyncStorage`-backed session persistence (`storage: AsyncStorage`, `detectSessionInUrl: false`) since RN has no browser localStorage/URL-based session detection.
- **`optcgapi.js`** wraps the third-party OPTCG API (optcgapi.com, credited to "DomoBot"):
  - `getCard`/`getCardVariants`/`enrichCards`/`searchLeaders`/`searchCards`/`getCardImageUrl` — the single source of all card data/images/search across the entire app.
  - Heavy **localStorage caching**: permanent card-by-ID cache + 24h-TTL caches for starter decks/promos/per-set lists. Mobile needs an AsyncStorage-equivalent cache with the same key/TTL structure to avoid hammering the third-party API.
  - Multi-word name search has a special fallback (re-query first token, filter locally) because the API's substring match doesn't handle spacing/punctuation differences well.
  - Special-cased set handling: `EB04` has no standalone API endpoint (reconstructed from OP14+OP15), some sets fall back to a hyphenated endpoint variant.
  - Base-card-ID regex conventions (`^[A-Z]{1,3}[0-9]{0,3}-[0-9]+`) are reused identically across LogResult, Stats, DeckBuilder, CardScanner — should live in one shared utility to avoid drift between web and mobile.

---

## Known Non-Functional / Placeholder UI (do not assume these need building unless explicitly requested)

- **Profile page "Export CSV" button** — no handler wired.
- **Decklists page "Copy Decklist" button** (inside DeckModal) — no handler wired.
- **StorefrontPage has no owner-side inbox** to view/reply to buyer message threads (functional gap, not a missing button — there's no UI path to it at all).
- **LiveTournament.jsx has dead code**: a `handleFinish()` using a native `prompt()` for placement, superseded by the modal's own inline finish handler — don't replicate the `prompt()` version.
- **Tournament decklist visibility** ("hidden until completed") is enforced only by hiding the UI tab, not server-side — a determined API caller could read other players' decklists early. Worth flagging, not necessarily fixing on mobile.
- **Tournament delete cascade** (sim tournaments) has no transaction — a failure partway through the 4-table cascade can leave a partial delete. Known latent issue in the web app, not a mobile-specific concern.
