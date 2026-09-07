import {describe, expect, it} from 'vitest';

import {assertOpenMessageReport, assertReportableMessage} from './message-report-domain';

describe('message report permissions and lifecycle', () => {
  it('allows only the recipient to report a message', () => {
    expect(() =>
      assertReportableMessage({
        actorId: 'buyer',
        buyerId: 'buyer',
        sellerId: 'seller',
        senderId: 'seller',
        conversationStatus: 'open'
      })
    ).not.toThrow();
    expect(() =>
      assertReportableMessage({
        actorId: 'seller',
        buyerId: 'buyer',
        sellerId: 'seller',
        senderId: 'seller',
        conversationStatus: 'open'
      })
    ).toThrow(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertReportableMessage({
        actorId: 'intruder',
        buyerId: 'buyer',
        sellerId: 'seller',
        senderId: 'seller',
        conversationStatus: 'open'
      })
    ).toThrow(expect.objectContaining({code: 'NOT_FOUND'}));
    expect(() =>
      assertReportableMessage({
        actorId: 'buyer',
        buyerId: 'buyer',
        sellerId: 'seller',
        senderId: 'seller',
        conversationStatus: 'closed'
      })
    ).toThrow(expect.objectContaining({code: 'CONFLICT'}));
  });

  it('blocks participant self-review and stale decisions', () => {
    const openReport = {
      reportStatus: 'open' as const,
      conversationStatus: 'open' as const,
      reporterId: 'buyer',
      buyerId: 'buyer',
      sellerId: 'seller'
    };
    expect(() => assertOpenMessageReport({...openReport, reviewerId: 'moderator'})).not.toThrow();
    expect(() => assertOpenMessageReport({...openReport, reviewerId: 'buyer'})).toThrow(
      expect.objectContaining({code: 'FORBIDDEN'})
    );
    expect(() =>
      assertOpenMessageReport({
        ...openReport,
        reviewerId: 'moderator',
        reportStatus: 'resolved'
      })
    ).toThrow(expect.objectContaining({code: 'CONFLICT'}));
    expect(() =>
      assertOpenMessageReport({
        ...openReport,
        reviewerId: 'moderator',
        conversationStatus: 'closed'
      })
    ).toThrow(expect.objectContaining({code: 'CONFLICT'}));
  });
});
