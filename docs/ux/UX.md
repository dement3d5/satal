# UX and design direction

## Experience goal

Within seconds a visitor should understand the marketplace, reach a popular leaf category or search, apply useful filters, and understand a listing's item, price, place, seller and freshness.

## Visual system

Light neutral surfaces, near-black text, one calm accent, moderate radii, restrained elevation and motion. Avoid gradients, glassmorphism, decorative 3D, huge shadows and badge noise. Use semantic reusable primitives, visible focus and skeleton states.

## Responsive behavior

Desktop uses a prominent search/location header, direct category links, sidebar filters and list-first results. Mobile uses touch-sized controls, compact cards, a dedicated category view, filter sheet and sticky listing contact actions where appropriate. Do not merely shrink desktop CSS.

The global header keeps discovery actions clear without exposing irrelevant private destinations. Guests see language selection, sign-in and the primary listing action; messages, saved items, notifications and the profile menu render only after the session is confirmed. The language menu preserves the current localized route, while compact icon labels and account actions remain keyboard accessible across breakpoints.

## Localization

AZ is default; RU and EN are complete peers. Routes and metadata are localized. Translation keys, pluralization, dates, numbers and AZN formatting use a real i18n layer. User-generated listing content is stored separately and is not assumed translated.

## Key states

Design and test loading, empty, upload failure/processing, offline/network error, unauthorized/forbidden, moderation pending/rejected, sold, expired, removed, banned and server-error states. Forms keep user input after failures and show field errors in human language.

## Accessibility/SEO

Semantic landmarks and controls, keyboard navigation, labels, contrast, reduced motion and correct dialogs are baseline. Public listings/categories use SSR, clean canonical localized URLs, structured metadata, Open Graph and controlled indexing of filter combinations.

## Listing creation UI foundation

The first visual listing flow lives at `/{locale}/sell` and is intentionally mobile-first. It presents category, details, location and review as a short progressive flow rather than one long form. Category choices, localized labels, validation constraints and control types come from the catalog API; frontend code contains no category-specific field lists.

Authenticated sessions receive a PostgreSQL-backed draft and debounced optimistic autosave. Without a session, the same schema can be previewed locally, but the interface explicitly states that it is not persisted. Approximate location is selected through the geography hierarchy and the interface explains that a private seller's exact address is not public.

Search, media upload and publication now have real application boundaries; phone OTP remains visibly unavailable until a verified provider is connected. The UI does not simulate successful external integrations.

## Trust interactions

An authenticated non-seller can report an active listing from its seller card without seeing or supplying ownership identifiers. The form uses a short fixed reason list, optional bounded context and clear authenticated/rate-limited/error/success states. Seller rejection details live with the seller's own listing in the account. One compact appeal form preserves the statement after validation and shows open, accepted and rejected outcomes plus the safe staff response. Staff see new listings, user reports and seller appeals as separate queue sections so each decision has an explicit consequence.

The listing seller card also starts a private conversation with one bounded text message. The inbox keeps the listing context visible, separates conversations from message history, shows unread state, preserves input on failures and explains rate/lifecycle/block outcomes without revealing which internal check failed. A participant can block or unblock the other from the conversation; history remains readable. The client refreshes persisted state while a production realtime transport remains pending.

Each received message has a compact, secondary report action with a fixed localized reason list and optional bounded context. Successful retries do not duplicate a report. The staff workspace shows message reports separately from listing reports and makes the consequence explicit: dismiss the report or close only that conversation. Reporter identity and unrelated message history are not displayed. After a confirmed closure, both participants retain readable history and see a clear explanation that the decision affects the conversation rather than silently implying an account ban.

After both sides have messaged, the seller sees a deliberate confirmation for “sold to this buyer.” The copy explains that it marks the listing sold and cannot be undone in the current UI. Once confirmed, each participant sees one compact rating/review form in the conversation. Submitted feedback is immutable and the UI states whether it is still blind or already public. Seller cards link to a public profile that shows only revealed review aggregates and review content, never contact or conversation data.

The notification center shows recipient-only message events, unread state and a direct route back to the conversation. In-app chat notifications can be disabled. Email and push controls remain visibly unavailable until real delivery providers are verified, so the interface never claims an external notification was sent.

## Review reporting

Authenticated readers other than the author get a compact report control beneath each public review. It uses a fixed localized reason list, optional bounded context and explicit success, rate-limit and error states. Staff see reported reviews in a separate queue with the author, subject and exact review content, but never reporter identity. The two decisions state their scope plainly: dismiss the report or hide the review.

## Account dashboard

The localized account route is the user's home inside Satal rather than a bare identity form. It combines a recognizable profile header, account age and public reputation link with listing-status totals, direct access to messages, saved items, notifications and staff tools, and separate personal-data and session-security cards. Email and phone remain private and verification limitations are stated next to the relevant field.

Sign-out uses Better Auth's browser client, waits for the server response and verifies that the private profile endpoint is unauthorized before leaving the page. A hard navigation then prevents stale React state from displaying the previous account. The explicit switch-account action ends the same server session and opens a clean sign-in/create-account screen with a localized completion message.
