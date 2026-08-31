import {z} from 'zod';

export const authorizeMediaUploadSchema = z.object({
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  bytes: z
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[0-9a-f]{64}$/)
});

export type AuthorizeMediaUploadInput = z.infer<typeof authorizeMediaUploadSchema>;

export const arrangeDraftMediaSchema = z.object({
  assetIds: z.array(z.uuid()).max(12),
  coverAssetId: z.uuid().nullable()
});

export type ArrangeDraftMediaInput = z.infer<typeof arrangeDraftMediaSchema>;

export interface DraftMediaContract {
  assetId: string;
  status: 'pending_upload' | 'quarantined' | 'processing' | 'ready' | 'rejected';
  mediaType: string;
  bytes: number;
  sortOrder: number;
  isCover: boolean;
}
