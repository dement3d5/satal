import {z} from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const businessHourSchema = z.discriminatedUnion('isClosed', [
  z.object({weekday: z.int().min(0).max(6), isClosed: z.literal(true)}),
  z
    .object({
      weekday: z.int().min(0).max(6),
      isClosed: z.literal(false),
      opensAtMinute: z.int().min(0).max(1439),
      closesAtMinute: z.int().min(1).max(1440)
    })
    .refine((value) => value.opensAtMinute < value.closesAtMinute, {
      message: 'Closing time must be later than opening time'
    })
]);

export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).default(''),
  locationId: z.uuid().nullable().optional(),
  publicAddress: nullableText(300).optional(),
  publicPhone: nullableText(32).optional(),
  businessHours: z.array(businessHourSchema).max(7).default([])
});

export const updateShopSchema = z
  .object({
    version: z.int().positive(),
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(3000).optional(),
    locationId: z.uuid().nullable().optional(),
    publicAddress: nullableText(300).optional(),
    publicPhone: nullableText(32).optional(),
    businessHours: z.array(businessHourSchema).max(7).optional()
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.locationId !== undefined ||
      value.publicAddress !== undefined ||
      value.publicPhone !== undefined ||
      value.businessHours !== undefined,
    {message: 'Shop update must contain at least one change'}
  );

export const addShopMemberSchema = z.object({
  email: z.email().max(320),
  role: z.enum(['manager', 'listing_manager'])
});

export const submitShopVerificationSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  registryNumber: nullableText(120).optional(),
  statement: z.string().trim().min(20).max(2000)
});

export const decideShopVerificationSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reviewerNote: z.string().trim().min(10).max(2000)
});

export const shopMediaKindSchema = z.enum(['logo', 'cover']);

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type SubmitShopVerificationInput = z.infer<typeof submitShopVerificationSchema>;
export type DecideShopVerificationInput = z.infer<typeof decideShopVerificationSchema>;
