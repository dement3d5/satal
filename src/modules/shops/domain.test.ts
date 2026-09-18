import {describe, expect, it} from 'vitest';

import {AppError} from '@/server/errors/app-error';

import {assertBusinessHours, assertShopCapability, slugifyShopName} from './domain';

describe('shop domain', () => {
  it('keeps membership capabilities least-privileged', () => {
    expect(() => assertShopCapability('listing_manager', 'listings:manage')).not.toThrow();
    expect(() => assertShopCapability('listing_manager', 'profile:manage')).toThrow(AppError);
    expect(() => assertShopCapability('manager', 'members:manage')).toThrow(AppError);
    expect(() => assertShopCapability('owner', 'members:manage')).not.toThrow();
  });

  it('rejects duplicate business weekdays', () => {
    expect(() =>
      assertBusinessHours([
        {weekday: 1, isClosed: true},
        {weekday: 1, isClosed: false, opensAtMinute: 540, closesAtMinute: 1080}
      ])
    ).toThrow(AppError);
  });

  it('creates stable URL-safe slugs for supported scripts', () => {
    expect(slugifyShopName('Əla Mağaza')).toBe('ela-magaza');
    expect(slugifyShopName('Новый магазин')).toBe('noviy-magazin');
    expect(slugifyShopName('***')).toBe('shop');
  });
});
