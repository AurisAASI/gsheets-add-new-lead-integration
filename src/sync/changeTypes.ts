/** Change types that may mean new or updated lead data. */
export const RELEVANT_CHANGE_TYPES = new Set([
  'EDIT',
  'INSERT_ROW',
  'OTHER',
]);

export function isRelevantChangeType(changeType: string): boolean {
  return RELEVANT_CHANGE_TYPES.has(changeType);
}
