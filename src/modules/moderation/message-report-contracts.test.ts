import {describe, expect, it} from 'vitest';

import {createMessageReportSchema, messageReportDecisionSchema} from './message-report-contracts';

describe('message report contracts', () => {
  it('normalizes a bounded report and requires context for another reason', () => {
    expect(
      createMessageReportSchema.parse({
        reason: 'fraud',
        details: '  The sender requested an advance payment.  '
      })
    ).toEqual({reason: 'fraud', details: 'The sender requested an advance payment.'});
    expect(() => createMessageReportSchema.parse({reason: 'other'})).toThrow();
    expect(() =>
      createMessageReportSchema.parse({reason: 'other', details: 'Too short'})
    ).toThrow();
  });

  it('accepts only explicit staff outcomes', () => {
    expect(messageReportDecisionSchema.parse({action: 'dismiss'})).toEqual({action: 'dismiss'});
    expect(messageReportDecisionSchema.parse({action: 'close_conversation'})).toEqual({
      action: 'close_conversation'
    });
    expect(() => messageReportDecisionSchema.parse({action: 'ban_user'})).toThrow();
  });
});
