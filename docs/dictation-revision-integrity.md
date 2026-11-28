# Dictation revision integrity

The practice endpoint issues a signed ticket for the authenticated student profile, dictation ID, exact SHA-256 transcript digest, YouTube ID, and publication timestamp. The server generates a unique submission key and signs it into the ticket. The ticket expires after eight hours for unsaved attempts. It carries no transcript, has no server-side session record, and is private and uncacheable. Practice still begins at the first committed input.

If an administrator edits a published transcript, the same update transaction preserves the old text by digest in the existing immutable DictationReference table. The admin compare-and-swap uses a monotonically advancing edit timestamp. A submission uses its authorized digest, reading the current transcript if it matches or the immutable prior revision otherwise. It never falls back to a different digest. The final write locks and rechecks the published dictation and recording, then writes the existing attempt and reference fields in one transaction. Admin edits and submission commits acquire locks in the same order.

A changed recording, unavailable archived revision, expired ticket, deleted dictation, unpublish or change of publication window blocks a new save. Republishing after an archive creates a new authorization window. The failure shows the unsaved transcription for manual copying and offers a fresh load with discard confirmation. Network and session failures retain the original payload for retry. An authenticated replay with the original signed scope and identical payload can recover an already saved result even after expiry or unpublication. A changed payload conflicts. Replay lookup remains rate-limited and profile-scoped. A key signed with a now-rotated authentication secret cannot replay, but saved results remain available in history.

This protects reference integrity rather than proving that someone typed the text or measuring elapsed time on the server. The sanctioned study view remains available for published dictations. There are no new migrations, reference reads in the catalog, or writes when opening practice. Saving an edited published transcript can add one deduplicated reference row under the existing capacity guard. Unused immutable revisions are retained because they can serve an in-progress ticket. No automatic retention change was introduced. Cached pre-change clients must reload to obtain a signed ticket. Their old payload fails closed.

## Omission ambiguity in scoring version 1

Reference: `beta , gamma alpha delta`  
Typed: `delta alpha alpha ,`

In order: substitute `beta → delta`, delete `,`, substitute `gamma → alpha`, equal `alpha`, delete `delta`, insert `,`. There is one correct item. The current denominator is six: four typed tokens plus the two deletions preceding a typed operation. Accuracy is floor(100 × 1 / 6) = 16%.

The paired reach boundary ends at the equal `alpha`. Review shows the internal comma as skipped and `delta` as not reached. The trailing extra comma does not extend paired reach. A hypothetical scoring version based on paired reach would use five evaluated items and show 20%. The current UI explains that the extra caused an otherwise unreached item to count. A trailing mark omitted after the last paired reference word remains scored when the punctuation exception applies. Partial final words can be substitutions. Repeated words can have equally valid alignments, so the recorded operation order is the source of truth.

## Unicode follow-up

Version 1 deliberately splits ASCII letter/digit runs, retains internal straight apostrophes and hyphens, groups other non-whitespace characters into punctuation runs, and compares case exactly. Consequently raw `café` is split into a word and a punctuation token, and a decomposed accent can tokenize differently. Custom reference preparation already transliterates supported Latin accents. Typing and dictation scoring still use whitespace normalization only.

A later scoring version could normalize both sides to NFC and tokenize letters, numbers, and attached combining marks using Unicode properties. Preserve accents and case. Treat straight and curly internal apostrophes as word connectors under an explicit equivalence policy, while retaining quote marks as punctuation outside words. Handle intra-word hyphens separately from en/em dashes. Keep decimals, abbreviations and foreign/legal names under tested policy examples. Define segmentation for scripts without spaces before claiming multilingual word scores. Emoji and symbols should retain explicit scored classes or policies, with grapheme boundaries where appropriate. Coverage and WPM must continue using versioned character counting if their unit changes.

Save a new scoreVersion only for newly scored attempts and select the corresponding tokenizer/alignment for historical comparisons. Keep the stored historical metrics, immutable references, and old version review behavior. Neither tokenization nor scoring arithmetic changed in this work.

Other reproduced version-one cases:

| Reference | Typed | Current review and score |
| --- | --- | --- |
| `alpha beta gamma` | `alpha be` | `be` substitutes for `beta`; `gamma` is unreached. 1/2 = 50%. |
| `alpha beta beta gamma` | `alpha beta gamma` | The alignment skips the second `beta`. 3/4 = 75%. |
| `alpha beta.` | `alpha beta` | The terminal period is skipped under the last-word exception. 2/3 = 66%. |
| `alpha beta gamma` | `alpha beta gamma !` | The exclamation mark is a true extra. No omission. 3/4 = 75%. |
| `alpha beta gamma.` | `alpha beta !` | The alignment substitutes `!` for `.` and counts `gamma` as skipped. This is a paired-substitution case. 2/4 = 50%. |
