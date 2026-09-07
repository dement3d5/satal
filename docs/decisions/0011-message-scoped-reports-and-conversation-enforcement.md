# ADR 0011: Message-scoped reports and conversation enforcement

- Status: accepted
- Date: 2026-09-08

## Context

Phase 4 chat needs a safe way to report fraud, harassment, prohibited content and exposed personal data. A free-form conversation report would give staff excessive access to unrelated private history, make retries ambiguous and leave enforcement scope unclear. The platform does not yet have a reviewed account-ban model or retention policy that would justify automatically escalating one message report into a global restriction.

## Decision

Persist one relational `message_report` per `(reporter, message)` and one immutable `message_report_action` for its staff outcome. The server derives the reporter from the session, verifies that the message belongs to the requested conversation, requires the reporter to be the recorded recipient, serializes reporter writes and limits new reports to ten per rolling hour. Fixed reason values are stored relationally; optional bounded context remains a column, not an unstructured policy document.

The staff queue returns only the reported message, listing title, sender display name, reason, bounded context and timestamp. Reporter identity and unrelated messages are omitted. A live moderation capability is required, and any staff member who participated in the conversation is excluded from both queue and decision paths.

Staff may dismiss one report or confirm the violation by closing the conversation. Confirmation locks the conversation, resolves every open report attached to its messages, appends one action per report and writes `chat.conversation_closed` in the same PostgreSQL transaction. History remains readable to the participants. This action does not ban a user or remove the listing.

## Consequences

PostgreSQL remains authoritative for evidence, lifecycle and audit; retries are deterministic and enforcement is narrow and explainable. Staff cannot browse arbitrary chat history through this feature. Reported-message records restrict physical deletion of their evidence, so production launch still requires legally reviewed retention/export/deletion rules and monitored staff access. Risk aggregation, account warnings, temporary restrictions and bans remain a separate milestone rather than implicit side effects of one report.
