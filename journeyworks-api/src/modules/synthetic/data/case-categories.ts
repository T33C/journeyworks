/**
 * Case Categories Data
 *
 * Sourced from the bank's QlikView customer complaints system.
 * Contains historical Area of Issue / Reason for Complaint categories
 * with their logged volumes for weighted random selection.
 *
 * @source documentation/design/case data/case-issues-and-complaint-reasons.csv
 */

export interface CaseCategoryData {
  areaOfIssue: string;
  reasonForComplaint: string;
  weight: number; // from 'Logged Vol' - used for weighted random selection
}

/**
 * All case categories from the CSV, cleaned and parsed.
 * Weights are the 'Logged Vol' values from QlikView.
 */
export const CASE_CATEGORIES_FROM_CSV: CaseCategoryData[] = [
  // Account Opening Process
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'Actioned incorrectly/Not Actioned', weight: 190 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'Card not received', weight: 6 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'Communication not received', weight: 49 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'Credit Limit', weight: 7 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: "Decline/Doesn't meet criteria", weight: 144 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'ID&VA New to Bank', weight: 18 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'Incorrect information provided', weight: 41 },
  { areaOfIssue: 'Account Opening Process', reasonForComplaint: 'Took too long/delays', weight: 318 },

  // Call Handling / Customer Interaction
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Disconnected/cut off', weight: 100 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Does not want to self serve', weight: 10 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: "Don't understand", weight: 45 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Incorrect information provided', weight: 375 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Lack of Ownership/Non Follow-up', weight: 243 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Poor Communication', weight: 345 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Security/Verification', weight: 418 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Took too long/delays', weight: 208 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Transferred to wrong dept', weight: 84 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Unable to action/answer', weight: 191 },
  { areaOfIssue: 'Call Handling / Customer Interaction', reasonForComplaint: 'Wait time', weight: 86 },

  // CDD Remediation
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Account Closed', weight: 56 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Branch Error / Unable to Assist', weight: 5 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: "Can't/won't provide documents/information", weight: 22 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Communication style/tone', weight: 115 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Concerned request not genuine', weight: 6 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Documents lost', weight: 5 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Incorrect information provided', weight: 37 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Nature/suitability of questions', weight: 25 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Restrictions / blocks / inhibits', weight: 353 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Took too long/delays', weight: 57 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Unable to access', weight: 36 },
  { areaOfIssue: 'CDD Remediation', reasonForComplaint: 'Unhappy with decision', weight: 62 },

  // Fees, Charges and Interest
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: 'Actioned incorrectly/Not Actioned', weight: 335 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: "Can't afford to pay", weight: 8 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: 'Charges debited from wrong account', weight: 12 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: "Don't understand", weight: 65 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: 'Exchange rate different', weight: 16 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: 'Incorrect amount charged', weight: 6 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: 'Fee too high', weight: 153 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: 'Unfairly charged', weight: 11 },
  { areaOfIssue: 'Fees, Charges and Interest', reasonForComplaint: "Wasn't aware of the fee", weight: 125 },

  // Payment processing
  { areaOfIssue: 'Payment processing', reasonForComplaint: 'Actioned incorrectly/Not Actioned', weight: 379 },
  { areaOfIssue: 'Payment processing', reasonForComplaint: "Decline/Doesn't meet criteria", weight: 102 },
  { areaOfIssue: 'Payment processing', reasonForComplaint: 'Fraud process/policy', weight: 128 },
  { areaOfIssue: 'Payment processing', reasonForComplaint: 'Incorrect information provided', weight: 131 },
  { areaOfIssue: 'Payment processing', reasonForComplaint: 'Not received by payee', weight: 200 },
  { areaOfIssue: 'Payment processing', reasonForComplaint: 'Service provided', weight: 206 },
  { areaOfIssue: 'Payment processing', reasonForComplaint: 'Took too long/delays', weight: 281 },
];

/**
 * Unique areas of issue for category-level selection
 */
export const AREAS_OF_ISSUE = [
  'Account Opening Process',
  'Call Handling / Customer Interaction',
  'CDD Remediation',
  'Fees, Charges and Interest',
  'Payment processing',
] as const;

export type AreaOfIssue = (typeof AREAS_OF_ISSUE)[number];

/**
 * Total weight for probability calculations
 */
export const TOTAL_WEIGHT = CASE_CATEGORIES_FROM_CSV.reduce(
  (sum, c) => sum + c.weight,
  0,
);

/**
 * Case title templates by Area of Issue
 * Uses placeholders: {days}, {amount}, {product}, {date}
 */
export const CASE_TITLES_BY_AREA: Record<AreaOfIssue, string[]> = {
  'Account Opening Process': [
    'Account application not processed after {days} days',
    'New card never arrived for account opening',
    'No confirmation received for account application',
    'Credit limit query on new account',
    'Account application declined unexpectedly',
    'ID verification issues during account opening',
    'Incorrect details on new account',
    'Excessive delays in account opening process',
  ],
  'Call Handling / Customer Interaction': [
    'Call disconnected during important query',
    'Forced to use self-service when assistance needed',
    'Confusing explanation provided by agent',
    'Given incorrect information by support',
    'No follow-up after promised callback',
    'Poor communication from customer service',
    'Excessive security questions during call',
    'Long wait time of {days} minutes on hold',
    'Transferred to wrong department multiple times',
    'Agent unable to resolve my issue',
  ],
  'CDD Remediation': [
    'Account closed without proper notice',
    'Branch unable to assist with documentation',
    'Cannot provide requested documents',
    'Unhappy with tone of CDD communications',
    'Suspicious of CDD request authenticity',
    'Submitted documents were lost',
    'Wrong information about CDD requirements',
    'Inappropriate questions during review',
    'Account restrictions during CDD review',
    'CDD review taking too long',
    'Cannot access account during review',
    'Disagree with CDD decision',
  ],
  'Fees, Charges and Interest': [
    'Disputed fee of {amount} not refunded',
    'Cannot afford current charges',
    'Fee charged to wrong account',
    "Don't understand fee breakdown",
    'Exchange rate different from quoted',
    'Incorrect amount of {amount} charged',
    'Fee of {amount} is excessive',
    'Unfairly charged for {product}',
    'Was not informed about {amount} fee',
  ],
  'Payment processing': [
    'Payment of {amount} not processed correctly',
    'Payment declined without explanation',
    'Fraud block on legitimate payment',
    'Given wrong payment information',
    'Payment of {amount} not received by payee',
    'Poor service during payment issue',
    'Payment delayed by {days} days',
  ],
};

/**
 * Case description templates by Area of Issue
 * Uses placeholders: {days}, {amount}, {product}, {date}, {region}
 */
export const CASE_DESCRIPTIONS_BY_AREA: Record<AreaOfIssue, string[]> = {
  'Account Opening Process': [
    'Customer submitted account application on {date} but has not received any updates. Multiple follow-ups have been made without resolution.',
    'New debit/credit card was expected within 7-10 days but has not arrived after {days} days. Customer unable to access funds.',
    'Customer did not receive confirmation email or letter after account application. Uncertain if application was successful.',
    'Customer disputes the credit limit assigned to new account. Believes it should be higher based on income and credit history.',
    'Account application was declined. Customer believes they meet all criteria and requests explanation of decision.',
    'ID verification process is causing issues. Customer has provided all requested documents but verification keeps failing.',
    'Account was opened with incorrect personal details. Customer needs urgent correction before using the account.',
    'Account opening process has taken over {days} days. Customer needs account urgently for salary payments.',
  ],
  'Call Handling / Customer Interaction': [
    'Customer was in the middle of an important query when the call was disconnected. Had to start over with a new agent.',
    'Customer asked for human assistance but was repeatedly directed to self-service channels. Issue requires human intervention.',
    'Agent provided explanation that customer found confusing and contradictory. Request for clearer communication.',
    'Customer received incorrect information from agent which led to further issues. Seeking correction and apology.',
    'Agent promised to call back within 24 hours but no callback received after {days} days.',
    'Customer finds communication from the bank to be unclear and unprofessional. Requests improvement in service quality.',
    'Customer frustrated with extensive security verification process. Took {days} minutes just to verify identity.',
    'Customer was on hold for over {days} minutes before speaking to an agent. Wait times are unacceptable.',
    'Customer transferred between {days} different departments without resolution. No one took ownership of the issue.',
    'Agent was unable to answer customer question or resolve issue. Customer left without solution.',
  ],
  'CDD Remediation': [
    'Customer account was closed as part of CDD review without adequate notice. Customer needs explanation and possible reinstatement.',
    'Customer visited {region} branch for CDD assistance but staff were unable to help. Directed to call centre repeatedly.',
    'Customer unable to provide specific documents requested for CDD. Needs alternative verification methods.',
    'Customer unhappy with the tone and wording of CDD letters. Finds them threatening and accusatory.',
    'Customer received CDD request and is concerned it may be a scam. Needs confirmation of legitimacy.',
    'Customer submitted CDD documents but they were lost. Now being asked to resubmit again.',
    'Customer given wrong information about CDD requirements. Now facing account restrictions.',
    'Customer finds some CDD questions intrusive and inappropriate. Requests explanation of necessity.',
    'Account has restrictions due to ongoing CDD review. Customer cannot access funds and is facing hardship.',
    'CDD review has been ongoing for {days} days. Customer needs timeline for resolution.',
    'Customer cannot access online banking during CDD review. Needs alternative access method.',
    'Customer disagrees with adverse CDD decision. Requests appeal process information.',
  ],
  'Fees, Charges and Interest': [
    'Customer disputes fee of {amount} which they believe was incorrectly applied. Requests investigation and refund.',
    "Customer facing financial hardship and cannot afford current fee structure. Requests fee reduction or waiver.",
    'Fee of {amount} was debited from the wrong account. Customer requests correction and compensation.',
    'Customer does not understand the fee breakdown on their statement. Requests detailed explanation.',
    'Exchange rate applied was different from rate quoted at time of transaction. Customer lost {amount}.',
    'Statement shows incorrect fee amount. Customer was charged {amount} instead of expected amount.',
    'Customer believes fee of {amount} is excessive compared to other providers. Considers switching.',
    'Customer feels unfairly charged for {product}. Was not aware this would incur additional fees.',
    'Customer was not informed about fee of {amount} when signing up. Requests waiver and apology.',
  ],
  'Payment processing': [
    'Payment of {amount} was not processed correctly. Funds were debited but payee did not receive them.',
    'Legitimate payment was declined. Customer needs explanation and immediate resolution.',
    'Payment was blocked by fraud prevention but customer confirms it was genuine. Needs urgent unblock.',
    'Customer given incorrect payment details by staff which caused payment to fail.',
    'Payee confirms payment of {amount} not received after {days} days. Customer needs trace and resolution.',
    'Customer unhappy with service received when trying to resolve payment issue.',
    'Payment has been delayed by {days} days. Payee is now charging late fees to customer.',
  ],
};
