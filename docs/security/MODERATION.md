# Moderation and risk

Satal uses explainable risk-based hybrid moderation, not a single opaque score or brittle keyword blacklist.

## Flow

- low risk: publish;
- medium risk: publish with prioritized post-review where policy permits;
- high risk: hold for manual review.

The implemented launch-safe baseline places every new listing in `pending_review`, evaluates a versioned deterministic policy and opens a relational case with a bounded priority, risk band and normalized signal summaries. Low-risk auto-approval remains disabled until policy review, monitoring and abuse tests exist. Approval is the only transition that makes a listing public and emits `listing.published` for derived search indexing.

Rules and thresholds are versioned. The first policy considers account tenure and structural contact patterns in public listing text. It persists only reason codes and weights—not the matched phone, email or URL—and only prioritizes human review. Future signals may include reputation, duplicate text and perceptual image hashes, category/price anomalies, reports and prior enforcement after policy review. IP is only a weak supporting signal and never a sole ban reason.

## Moderator experience

The staff queue prioritizes cases with localized reason summaries and policy version. Actions require a reason and create audit records. Rejected users receive a comprehensible, non-sensitive explanation plus edit/resubmit and appeal paths where applicable. Signal summaries never appear in seller-facing explanations or public APIs.

The current workspace enforces explicit, optionally expiring PostgreSQL role grants, rejects self-review, excludes staff-linked listings and conversations from decision queues, locks each case/report/appeal before deciding it and never returns contact, reporter identity or internal-note fields to the browser unnecessarily. Moderators can work queues; aggregated operations and the recent cross-queue action projection require `admin` or `owner`. There is no public role-management endpoint and no privileged seed user. Seller appeals preserve the original rejection and append a separate decision; acceptance only reopens review and preserves the original risk assessment. Assignment, broader evidence access and account enforcement workflows remain later additions.

## Reports and chat safety

Listing reports support fraud, wrong category, prohibited item, duplicate, misleading price, stale listing and other. Only authenticated non-sellers may report active listings; one reporter/listing relationship plus a serialized ten-per-hour limit reduces retry duplication and basic flooding. Staff may dismiss or confirm a report. Confirmation atomically removes the listing and resolves every open report without exposing reporter identities to the seller.

Chat has participant-only listing conversations, a per-sender rate bound and bidirectional blocks. Messages remain persisted after a block so users cannot erase the other participant's history. A recipient may report a concrete immutable message once using a bounded reason/context contract, with a serialized ten-per-hour limit. The staff queue exposes only that message and essential listing/sender context, excludes conversation participants, and records every dismissal or confirmed closure. Confirmation closes only the affected conversation and resolves its open reports; it does not ban either account. Later explainable signals may consider URLs, payment language, account/reputation and repeated patterns, but no opaque keyword rule currently removes or bans a user.

Public review reports use spam, harassment, exposed personal data, irrelevant content, prohibited content and other as bounded reasons. Only authenticated non-authors may report a currently visible review. The independent staff queue omits reporter identity and excludes the review author, subject and every user who reported that review. Staff may dismiss one report or atomically hide the review and resolve all open reports for it. Hiding immediately removes the review from the public list and rating aggregate; it does not ban an account.

## Policy dependency

Prohibited/restricted item categories are disabled until an Azerbaijan-specific policy is legally reviewed. The system must not invent law or expose internal detection rules to attackers.
