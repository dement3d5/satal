export interface LocationContract {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  kind:
    | 'country'
    | 'economic_region'
    | 'city'
    | 'district'
    | 'settlement'
    | 'neighborhood'
    | 'metro'
    | 'street';
  depth: number;
  verified: boolean;
}
