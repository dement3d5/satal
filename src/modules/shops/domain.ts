import {AppError} from '@/server/errors/app-error';

export type ShopMemberRole = 'owner' | 'manager' | 'listing_manager';
export type ShopCapability =
  'profile:manage' | 'media:manage' | 'listings:manage' | 'members:manage' | 'verification:submit';

const capabilities: Record<ShopMemberRole, ReadonlySet<ShopCapability>> = {
  owner: new Set([
    'profile:manage',
    'media:manage',
    'listings:manage',
    'members:manage',
    'verification:submit'
  ]),
  manager: new Set(['profile:manage', 'media:manage', 'listings:manage', 'verification:submit']),
  listing_manager: new Set(['listings:manage'])
};

export function hasShopCapability(role: ShopMemberRole, capability: ShopCapability): boolean {
  return capabilities[role].has(capability);
}

export function assertShopCapability(role: ShopMemberRole, capability: ShopCapability): void {
  if (!hasShopCapability(role, capability)) {
    throw new AppError('FORBIDDEN', 'Your shop role does not allow this action', 403);
  }
}

export function assertBusinessHours(
  hours: readonly {
    weekday: number;
    isClosed: boolean;
    opensAtMinute?: number;
    closesAtMinute?: number;
  }[]
): void {
  if (new Set(hours.map((item) => item.weekday)).size !== hours.length) {
    throw new AppError('BAD_REQUEST', 'Each weekday can appear only once', 400);
  }
}

export function slugifyShopName(name: string): string {
  const transliterated = name
    .toLocaleLowerCase('az')
    .replace(/[əә]/g, 'e')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[аә]/g, 'a')
    .replace(/[б]/g, 'b')
    .replace(/[в]/g, 'v')
    .replace(/[гҝ]/g, 'g')
    .replace(/[д]/g, 'd')
    .replace(/[её]/g, 'e')
    .replace(/[ж]/g, 'j')
    .replace(/[з]/g, 'z')
    .replace(/[иы]/g, 'i')
    .replace(/[й]/g, 'y')
    .replace(/[к]/g, 'k')
    .replace(/[л]/g, 'l')
    .replace(/[м]/g, 'm')
    .replace(/[н]/g, 'n')
    .replace(/[о]/g, 'o')
    .replace(/[п]/g, 'p')
    .replace(/[р]/g, 'r')
    .replace(/[с]/g, 's')
    .replace(/[т]/g, 't')
    .replace(/[у]/g, 'u')
    .replace(/[ф]/g, 'f')
    .replace(/[х]/g, 'h')
    .replace(/[ц]/g, 'c')
    .replace(/[ч]/g, 'ch')
    .replace(/[шщ]/g, 'sh')
    .replace(/[э]/g, 'e')
    .replace(/[ю]/g, 'yu')
    .replace(/[я]/g, 'ya')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return transliterated || 'shop';
}
