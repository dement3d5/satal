# ADR 0015: moderation assignment, SLA and bounded access audit

## Status

Accepted.

## Context

The shared listing queue allowed two moderators to start the same case and provided no explicit workload ownership or queue-age target. Owner/admin operations could show decisions but not whether staff had accessed the sensitive workspace. Full request logging would copy unnecessary identifiers, grow without a useful bound and create additional privacy risk.

## Decision

An open `moderation_case` may be unassigned or assigned to one live staff actor. `assigned_to` and `assigned_at` change together under a row lock. A moderator may claim an unassigned case and release their own case; `admin` and `owner` may release another assignee's case to recover stuck work. Claiming an already-owned case and releasing an already-unassigned case are idempotent. A decision may atomically claim an unassigned case, but a case assigned to somebody else returns conflict. Lifecycle and role-specific self-review checks still run inside the same transaction; ADR 0018 adds the narrow platform-owner exception for initial listing moderation.

Every effective claim or release appends a `moderation_case_assignment_event` with actor and previous/next assignee. These rows are audit history and are not updated in place.

Listing review has an explicit operational target of 24 hours, with “due soon” beginning at 18 hours. Queue age and SLA state are derived from `opened_at`; they do not change publication state and do not auto-approve, reject or reassign a case. The owner/admin panel shows assigned, unassigned, due-soon, overdue and oldest-open metrics.

Authorized access to the listing queue and operations panel is recorded in `moderation_workspace_access` as one aggregate per actor, surface and UTC date. It stores first/last access and a positive count—not routes, query text, listing/message content, network identifiers or risk evidence. Only `admin` and `owner` can read the bounded access projection.

## Consequences

- concurrent staff cannot both decide the same assigned case;
- operations can identify unowned or aging work without making enforcement automatic;
- assignment and workspace access are auditable with bounded data growth;
- there is intentionally no automatic assignment lease yet; privileged release handles abandoned work until staffing patterns justify a reviewed lease policy;
- account sanctions, detailed evidence-view audit and legally reviewed retention remain separate milestones.
