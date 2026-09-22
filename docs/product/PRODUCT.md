# Product definition

## Product promise

Satal is a universal classifieds marketplace for Azerbaijan where a visitor can move from the home page to a relevant listing in very few actions. Popular leaf categories are reachable directly, search is multilingual and typo tolerant, and public listings remain browseable without registration.

## Audiences

- private buyers and sellers;
- small merchants and shops;
- real-estate agents and auto dealers;
- companies operating across Azerbaijan.

The geographic model covers the country, not only Baku. Visitors abroad may browse, but listing geography is Azerbaijan-first.

For the initial launch, the home page editorially features only Baku apartments and passenger cars. Category and city identifiers are resolved from PostgreSQL, while search and the underlying data model retain every enabled location and category for later rollout.

The launch search surface follows the same two-category scope. Apartment filters prioritize building type, rooms, area, floor, repair, deed and mortgage; vehicle filters prioritize make/model discovery, year, mileage, condition, engine, fuel, transmission and body type. Labels, options, constraints and category applicability remain catalog data rather than frontend constants.

## MVP outcomes

- AZ/RU/EN responsive web and PWA foundations;
- data-driven categories and typed dynamic attributes;
- listing drafts, image processing, publication lifecycle, search and filters;
- phone-first account architecture, profiles and shops;
- favorites, saved searches, chat with text/images and notifications;
- reports, risk-based moderation, operational admin tools and audit;
- SEO-ready public category and listing pages;
- promotion/payment boundaries without premature payment implementation.

## Explicit non-goals

Native apps, video/voice, arbitrary attachments, wallet, subscriptions, comparison, ML recommendations, VoIP, full offline mode, QR codes, impersonation, microservices and Kubernetes are not MVP requirements.

## Product principles

When requirements compete, prefer: convenience, fewer actions, search quality, speed, security, mobile UX, calm design, SEO, scalability and then cost. Complexity needs a concrete product or operational reason.

## Success signals

Measure search-to-listing time, search refinement, listing creation completion, seller-contact initiation, favorites, conversations, moderation outcomes, saved-search engagement, retention, and promotion conversion. Do not label contacts as verified sales.
