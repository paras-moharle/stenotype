# Typing Results V2

The comparison walks the existing scored token operations in order. Insertions use their typed token at the position emitted by alignment. Substitutions keep the reference token inline and show expected and typed values in a single compact inspector on activation. Correct tokens share runs to keep long reviews readable and limit DOM size.

Timed practice uses the last equal or substituted reference token as its reach boundary. An earlier deletion is skipped. A later deletion is not reached, except that punctuation after the final reached reference word retains the scorer's omitted-punctuation convention. Trailing extras alone do not move the review boundary. Repeated or wholly different input can admit several alignments. The review follows the scorer's chosen pairing and does not infer intent. Completed untimed practice shows the full reference. Early exits can still show a compact comparison. Dictation always shows the full reference, including immutable references on historical results.

Reference items reconcile as correct + wrong + skipped + not reached. Typed items reconcile as correct + wrong + extras. These identities apply to the aggregate token counts. “Skipped” and “Not reached” are a presentation split of scored deletions. They do not change stored metrics. The accuracy scorer includes internal omissions before a later typed operation, including when that operation is an insertion, so its denominator should not be derived from the visible review categories in ambiguous alignments.

## Metric definitions

- Gross WPM divides the normalized typed string's length by five and by elapsed minutes, then rounds to the nearest integer. Spaces between tokens contribute to character length after whitespace normalization.
- Net WPM multiplies the unrounded gross rate by floored attempted accuracy, then rounds. Both speed measures require 3 seconds and 10 normalized typed characters.
- Attempted accuracy is floor(100 × exactly matched tokens / evaluated items). Evaluated items are typed tokens plus internal omissions and applicable final punctuation omissions. Unreached trailing reference tokens are generally excluded.
- Passage covered is floor(100 × (normalized reference length − character alignment deletions) / normalized reference length). Substitutions occupy reference positions. Extra typed characters do not improve coverage. This uses character alignment and JavaScript string lengths, independently of the word and punctuation token counts.
- Scored words are case-sensitive ASCII letter/digit runs with supported internal apostrophes and hyphens. Other non-whitespace runs are scored as punctuation. The review follows the scorer's existing treatment of Unicode and whitespace.
- Free and Custom evaluate locally with the shared scorer. Live non-blind metrics use the latest worker alignment. Blind practice exposes only input-derived measures before evaluation. Dictation persistence and saved scores come from the server. Historical headline metrics come from the saved attempt.

The reported example of 18 correct, 5 wrong and 2 extra yields 72% if there were no internal omissions (18 / 25). The 23 / 113 item fraction is approximately 20.35%, but cannot establish character coverage. Confirming the reported 19% exactly would require the original strings and their alignment. No production attempt was inspected.


## Follow-up scoring findings

- **Dictation revision during practice.** Previously the submission handler selected the current published transcript at submission. That was the previous behavior. The [revision integrity follow-up](dictation-revision-integrity.md) pins the published version and explains recovery behavior.
- **Wrong input can cover the whole passage.** With “alpha beta gamma” versus “xxxxx yyyy zzzzz”, character coverage is 100% and accuracy is 0%. Coverage measures positions, including substitutions. The result lists describe this as fully covered and avoid a success badge for coverage alone.
- **A trailing extra can affect omission accounting.** With “beta , gamma alpha delta” versus “delta alpha alpha ,”, four typed tokens and two omitted reference tokens contribute to the six-item accuracy denominator. The final omission precedes an insertion in the operation stream but follows the last paired reference index. Timed review leaves that word in the remainder rather than inferring that it was reached. The result shows the actual accuracy numerator and denominator. A scorer change would need a policy decision and versioning.
- **Unicode scoring is ASCII-oriented.** For raw input, the tokenizer treats “é” in “café” as punctuation. Custom-reference preparation transliterates compatible accents, but typed text uses the scorer's narrower whitespace normalization. Supporting equivalent composed/decomposed input and non-ASCII word boundaries would change scores. Preserve the current policy until that change has an agreed scoring version.
- **Dictation time is reported by the client.** The server recomputes accuracy and speed, enforces minimum elapsed time and rejects implausibly high raw WPM, but does not independently measure the typing interval. Scores should be used for practice feedback.
