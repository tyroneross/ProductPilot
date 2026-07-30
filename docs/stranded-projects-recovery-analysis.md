# Stranded Projects — Recovery Analysis

**Date:** 2026-07-30
**Scope:** read-only analysis of the production database. **No rows were modified.**
**Question:** how many guest-owned projects can be reattached to a real account?

## Answer

**None of them, by any automated signal available in this database.**

## The population

| Category | Projects |
|---|---|
| Account-owned (safe) | 5 |
| Guest-owned, created within the 30-day cookie life (at risk, still recoverable *by the user*) | 6 |
| Guest-owned, older than the 30-day cookie life (**stranded**) | **35** |
| **Total** | **46** |

Of the 35 stranded projects, **17 produced real work** — at least one stage with
progress > 0. These are not empty shells; they are documents somebody generated
and can no longer reach.

## Why they are stranded

`DEMO_OWNER_COOKIE_MAX_AGE_MS` is 30 days. Ownership of a guest project is
proven *only* by presenting that cookie. Once it expires:

- `GET /api/projects` returns only rows matching `user_id`, so the project is invisible.
- `loadOwnedProject` rejects the request, so a direct link 403s.
- The per-project claim requires a matching cookie, so it cannot be claimed either.

The row survives. The identity that could reach it does not.

## Signals evaluated for reattachment

Each was tested against production. All failed.

| Signal | Result | Why it fails |
|---|---|---|
| `llm_calls` rows carrying both `user_id` and `guest_owner_id` | **0 rows** | The two ids are never co-recorded, so no call ever links a guest identity to an account. |
| `audit_events` where a `user` acted on a guest-owned project | **0 rows** | Guest actions log as `actor_type='guest'`; there is no crossover event. |
| Activity-window overlap between guest and user in `llm_calls` | 13 apparent matches, but only **1 distinct `user_id` appears in `llm_calls` at all** | Every "overlap" is with the same single account, whose activity spans the whole period. The signal is noise — it would assign 21 different guests' work to one person. |
| `session.ip_address` / `session.user_agent` | Present on `session` only | Neither `projects` nor `llm_calls` records an IP or user agent, so there is no column to join on. Nothing links a browser to a project. |

## Conclusion

There is no evidence-based way to decide which account, if any, a stranded
project belongs to. Reassigning them would mean guessing, and a wrong guess
hands one person's product idea to a stranger — a worse outcome than the work
staying unreachable.

## Options

1. **Leave them.** No further data loss; 35 projects stay orphaned. Recommended default.
2. **Manual reattachment on request.** If a user contacts you describing their
   project, match on `name` / `description` / `created_at` and reassign that one
   row by hand. Evidence-based, one at a time, and auditable.
3. **Delete them.** They are unreachable and hold user-authored content. If they
   are never going to be recovered, deleting reduces the amount of orphaned
   personal content retained indefinitely. This is a privacy decision, not a
   technical one.

Options 2 and 3 both require a human decision and are deliberately not automated here.

## What is now prevented going forward

- Claiming a project transfers **every** project that guest cookie owns, so
  nothing is left behind the cleared cookie.
- Signing in triggers `POST /api/projects/claim-session`, so the Save dialog is
  no longer the only path that attaches work to an account.
- The client no longer reports "saved successfully" when the claim failed.

The 6 at-risk projects inside the 30-day window will be rescued automatically if
those users sign in before their cookie expires.
