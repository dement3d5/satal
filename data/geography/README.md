# Geography datasets

`dev.az.json` is a small illustrative development dataset, not a complete or verified register of Azerbaijan's administrative or address units. Its records exercise country, city, district, neighborhood and metro hierarchy and all three product locales.

Production import must use the same validated shape and additionally provide:

- an authoritative source and license recorded outside the payload;
- a stable source version and identifiers;
- reviewed AZ names plus RU/EN translations;
- parent/child validation and duplicate/alias review;
- a recorded verification timestamp during import.

No production deployment should infer official geography completeness from the dev seed.
