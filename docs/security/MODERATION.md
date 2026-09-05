# Moderation and risk

Satal uses explainable risk-based hybrid moderation, not a single opaque score or brittle keyword blacklist.

## Flow

- low risk: publish;
- medium risk: publish with prioritized post-review where policy permits;
- high risk: hold for manual review.

The implemented launch-safe baseline places every new listing in `pending_review` and opens a relational case. Low-risk auto-approval remains disabled until versioned rules, policy review, monitoring and abuse tests exist. Approval is the only transition that makes a listing public and emits `listing.published` for derived search indexing.

Thresholds and rules are versioned/configurable. Signals may include account age/reputation, duplicate text and perceptual image hashes, category/price anomalies, suspicious links/contact patterns, reports and prior enforcement. IP is only a weak supporting signal and never a sole ban reason.

## Moderator experience

The owner-facing queue prioritizes cases with reason summaries and evidence references. Actions require a reason and create audit records. Rejected users receive a comprehensible, non-sensitive explanation plus edit/resubmit and appeal paths where applicable.

The current queue enforces explicit, optionally expiring PostgreSQL role grants, rejects self-review, locks a case before deciding it and never returns contact or internal-note fields to the browser unnecessarily. There is no public role-management endpoint and no privileged seed user. Reopen, appeal, assignment and evidence workflows remain later additions.

## Reports and chat safety

Reports support fraud, wrong category, prohibited item, duplicate, misleading price, stale listing and other. Chat safety combines URLs, payment language, account/reputation and repeated patterns; users can block and report conversations/messages.

## Policy dependency

Prohibited/restricted item categories are disabled until an Azerbaijan-specific policy is legally reviewed. The system must not invent law or expose internal detection rules to attackers.
