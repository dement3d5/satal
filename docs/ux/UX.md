# UX and design direction

## Experience goal

Within seconds a visitor should understand the marketplace, reach a popular leaf category or search, apply useful filters, and understand a listing's item, price, place, seller and freshness.

## Visual system

Light neutral surfaces, near-black text, one calm accent, moderate radii, restrained elevation and motion. Avoid gradients, glassmorphism, decorative 3D, huge shadows and badge noise. Use semantic reusable primitives, visible focus and skeleton states.

## Responsive behavior

Desktop uses a prominent search/location header, direct category links, sidebar filters and list-first results. Mobile uses touch-sized controls, compact cards, a dedicated category view, filter sheet and sticky listing contact actions where appropriate. Do not merely shrink desktop CSS.

## Localization

AZ is default; RU and EN are complete peers. Routes and metadata are localized. Translation keys, pluralization, dates, numbers and AZN formatting use a real i18n layer. User-generated listing content is stored separately and is not assumed translated.

## Key states

Design and test loading, empty, upload failure/processing, offline/network error, unauthorized/forbidden, moderation pending/rejected, sold, expired, removed, banned and server-error states. Forms keep user input after failures and show field errors in human language.

## Accessibility/SEO

Semantic landmarks and controls, keyboard navigation, labels, contrast, reduced motion and correct dialogs are baseline. Public listings/categories use SSR, clean canonical localized URLs, structured metadata, Open Graph and controlled indexing of filter combinations.

## Listing creation UI foundation

The first visual listing flow lives at `/{locale}/sell` and is intentionally mobile-first. It presents category, details, location and review as a short progressive flow rather than one long form. Category choices, localized labels, validation constraints and control types come from the catalog API; frontend code contains no category-specific field lists.

Authenticated sessions receive a PostgreSQL-backed draft and debounced optimistic autosave. Without a session, the same schema can be previewed locally, but the interface explicitly states that it is not persisted. Approximate location is selected through the geography hierarchy and the interface explains that a private seller's exact address is not public.

Search, phone sign-in, media upload and publication controls are visibly non-operational until their dedicated milestones. The UI does not simulate successful integration for those boundaries.
