export const LISTING_RISK_POLICY_VERSION = 'listing-risk-v1';

export type ListingRiskSignalCode = 'new_account' | 'contact_details_in_content';

export interface ListingRiskSignal {
  code: ListingRiskSignalCode;
  weight: number;
}

export interface ListingRiskAssessment {
  policyVersion: typeof LISTING_RISK_POLICY_VERSION;
  score: number;
  riskBand: 'low' | 'medium' | 'high';
  signals: ListingRiskSignal[];
}

const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RISK_SCORE = 1000;
const HIGH_RISK_THRESHOLD = 50;

const contactPatterns = [
  /(?:https?:\/\/|www\.)\S+/iu,
  /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/iu,
  /(?:\+?\d[\s().-]*){9,15}/u
];

export function evaluateListingRisk(input: {
  sellerCreatedAt: Date;
  title: string;
  description: string;
  now: Date;
}): ListingRiskAssessment {
  const signals: ListingRiskSignal[] = [];
  const accountAgeMs = Math.max(0, input.now.getTime() - input.sellerCreatedAt.getTime());
  if (accountAgeMs < NEW_ACCOUNT_WINDOW_MS) {
    signals.push({code: 'new_account', weight: 30});
  }

  const publicText = `${input.title}\n${input.description}`;
  if (contactPatterns.some((pattern) => pattern.test(publicText))) {
    signals.push({code: 'contact_details_in_content', weight: 45});
  }

  const score = Math.min(
    MAX_RISK_SCORE,
    signals.reduce((total, signal) => total + signal.weight, 0)
  );
  return {
    policyVersion: LISTING_RISK_POLICY_VERSION,
    score,
    riskBand: score === 0 ? 'low' : score >= HIGH_RISK_THRESHOLD ? 'high' : 'medium',
    signals
  };
}
