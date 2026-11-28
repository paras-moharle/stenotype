# Administration V2

## Account policy

A student can sign in when the user is not banned and the profile is Active. Older inactive, suspended, and banned records are visible under Access disabled. Suspend changes the profile status and revokes sessions in the same transaction. Restore activates the profile and clears an old account block. Ownership checks remain in place on every protected student route. The dashboard count uses the same predicate.

Profile edits send only changed fields and the corresponding original values. The API compares under the student account lock. Updating an email normalizes it, removes the verification flag, and revokes sessions in the same transaction. Login events keep the address originally captured and can be opened by stable user ID.

Administrative reset replaces the credential using Better Auth's configured hasher, advances the user revision, and revokes sessions atomically. Concurrent requests using the same revision cannot both win. Replacement passwords are generated with 144 bits of random input unless a valid administrator-supplied value is chosen. The new value is returned once in a private no-store response. The site never exposes credential hashes. Deliver the replacement privately. It remains usable until changed by the student; no forced-change requirement is advertised. The Profile password change verifies the current password, uses the same hasher, and compares the previous hash before writing. It is rate-limited and revokes all sessions.

The account lock orders profile/status/credential changes, session revocation, student purge and result commits. New sign-in snapshots the account revision before password verification, then checks eligibility before session creation and rechecks the revision under the lock before returning a cookie. The database retains the existing single-session trigger. A result commit also rechecks the original session and eligibility before taking the dictation lock. Older application instances would not participate in these checks during a mixed-version rollout, so coordinate deployment with the existing maintenance procedure.

## Dictation creation and data lifecycle

The create form retains one random creation key per open form across retryable failures. The API requires that key, scopes it to the administrator, and records an immutable receipt containing a digest of the normalized request and the original dictation ID. The existing primary-keyed Verification table holds this small, application-namespaced receipt. Its far-future expiration keeps framework cleanup from removing an operation receipt. There is no plaintext transcript or credential in the receipt. The receipt and dictation commit together. Matching retries return the original ID after editing or deleting the dictation, without recreating it. A conflicting payload returns 409. Costs are one receipt row and indexed key per creation, with a lookup before the capacity guard. Do not bulk-clear Verification during maintenance. Older admin forms must reload to obtain a creation key. The new browser does not persist its unsaved draft across a reload.

Archive is history-preserving. It stops new practice and keeps the current row and all historical comparisons. Ordinary deletion is limited to unused dictations and students. The explicit purge action requires the current display name/title and result count, then checks both inside a transaction against the locked parent. Student purge deletes that student’s saved results and linked login audit events before deleting the account. Credentials, sessions and profile follow their existing relations. Dictation purge deletes only its attempts and row. Neither operation deletes shared immutable references. Existing practice tickets cannot recreate an account or dictation that no longer exists.

### Publication and student visibility

| Action | State and effects |
| --- | --- |
| Publish | Makes the same draft visible to students and available for new practice. |
| Unpublish | Returns the record to Draft and clears its publication timestamp. Students cannot browse or submit a new result for the draft. Publishing it again stamps a new publication, so an older ticket cannot submit. |
| Archive | Keeps the row, publication timestamp and saved history. Removes the record from the catalog and blocks new practice and unsaved submissions while archived. |
| Republish | Makes the same archived record visible again and starts a new publication. A ticket from the old publication cannot create a result, even if the recording is unchanged. The dictation ID and saved history are preserved. |
| Delete unused dictation | Removes the dictation only when its locked result count is zero. |
| Delete dictation and results | Requires the exact title and a fresh count, then atomically removes that dictation and its results. Immutable references remain. |

A matching retry for a saved attempt is separate from a new result and may still recover the saved result when the exercise is no longer published. A practice ticket cannot recreate a deleted dictation or account.

### Mixed-version release

1. Review the candidate and record the current release identity. Confirm which deployments, preview URLs, aliases and integrations have production write access. Check this in the hosting dashboard.
2. Build and verify the candidate against an isolated database. The existing schema is sufficient. Confirm the migration ledger and take the backup required by the [production runbook](production-database-release.md).
3. Gate user writes, including old deployment URLs, and drain in-flight requests. An alias change alone leaves older deployment URLs potentially reachable. Use deployment protection or revoke the old deployment's write access and verify the old URLs cannot mutate data before reopening writes.
4. Promote one version, reload open administrator tabs, and verify sign-in, suspension, password reset, publishing, idempotent creation and result recovery. Old forms cannot supply the new creation key or required field revisions.
5. On rollback, close writes until a compatible deployment is ready. An older app does not participate in the new locks and ignores creation receipts. Preserve the receipt rows and stop old writers before reopening a compatible version. There is no schema downgrade step for V2.

### Release verification checklist

1. Review the complete diff against `191edb7`. Review new files separately with `git ls-files --others --exclude-standard`. Run `git diff --check` and verify `git diff --exit-code -- prisma`. Stage reviewed paths only after approval, then use `git diff --cached --stat`, `git diff --cached --check` and `git diff --cached` before committing.
2. After Git approval, open a pull request into the release target to trigger CI. A push to `admin/mvp-v2` alone is outside the workflow's configured push branches. Inspect the hosted Results for both the integration and security jobs.
3. Before any approved push, confirm Vercel's Git integration, automatic deployment policy, production branch, preview environment scoping, available protection features and all mutable deployment URLs. Use a separately verified isolated database, preview-scoped secret and the exact preview HTTPS origin for authentication. Keep preview credentials separate from production.
4. On the isolated Preview, verify student and admin sign-in, logout and server-session invalidation. Record 10–20 warmed, comparable browser samples for logout and the core navigation paths. Use disposable rehearsal data for lifecycle, creation retry and cross-account checks. Save redacted traces.
5. Before promotion, gate every old writer, including direct deployment URLs, aliases and scheduled clients. Confirm the gate with an authorized maintenance check. If deployment protection is unavailable, use a verified alternative that actually removes the old runtime's write access. An alias change alone is insufficient. Drain active writes before taking the backup required by the [production runbook](production-database-release.md).
6. With the approved schema already in place, promote the tested build as the only writer. Ask administrators to reload open tabs. Verify normal sign-in, logout, navigation and read access, then run explicitly approved disposable mutation smokes. Reopen traffic after the health checks.
7. If rollback is needed, gate writes again and use the recorded compatible deployment. An older release without the V2 database locks or receipt checks is unsuitable for reopening writes without equivalent protections. Keep receipts intact. A database restore is a separate decision once new writes have been accepted.

## Migration proposals awaiting approval

- **Require password change.** Add a nullable timestamp or boolean marker on StudentProfile, defaulting to no requirement for existing accounts. Set it atomically with reset. Sign-in must support an authenticated, restricted password-change flow. All other protected routes must deny access while flagged. Clear the flag only after a successful reset credential replacement and session rotation. Test resets racing with login and old sessions. Storage is one small field per profile. Apply an additive migration first, then deploy guards and UI together. A rollback must retain the column and respect outstanding flags or pause access until resolved.
- **Permanently remove a dictation row while retaining its results.** Preserve stable historical title, category, identity and references before making the dictation relationship nullable with an explicit detach policy. Update results, counts, history filters and retry recovery so detached attempts stay visible. Backfill and compare counts before enabling deletion. Existing immutable references and legacy missing-reference behavior remain. Storage is per-attempt metadata or one small retained identity row. Add and backfill first, then enable detach. Once real rows are detached, rollback requires restoring compatible identities before making the relationship mandatory again.
- **Delete a single result with replay protection.** Add a minimal tombstone keyed by student and submission identity, with expiry beyond the original signed ticket plus a concurrency margin. Claim/check it inside the same serialized write path, and write it in the deletion transaction before removing the attempt. Do not store typed text or a transcript in the marker. Retain it until no old ticket can commit. The existing result list and progress aggregates update from surviving rows. Add the table and enforce it before exposing deletion. Rollback must preserve rejection of tombstoned keys until expiry or invalidate the affected tickets. Bulk purge of a parent avoids this replay problem because the parent independently ceases to be eligible.

The later [single-result rollout](single-saved-result.md) supersedes the earlier no-migration and retention assumptions. Its migration and retention policy require separate release verification.
