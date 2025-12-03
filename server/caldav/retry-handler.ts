/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: 2^retryCount minutes
 * Max: ~17 hours at retry 10
 */
export function calculateBackoff(retryCount: number): number {
  const minutes = Math.pow(2, retryCount);

  return minutes * 60 * 1000; // Convert to milliseconds
}

/**
 * Check if enough time has passed since last sync attempt
 */
export function shouldRetry(retryCount: number, lastSyncAt: Date | null): boolean {
  if (retryCount >= 10) return false;
  if (!lastSyncAt) return true;

  const backoffMs = calculateBackoff(retryCount);
  const nextRetryTime = new Date(lastSyncAt.getTime() + backoffMs);

  return new Date() >= nextRetryTime;
}

/**
 * Truncate error message to 500 characters
 */
export function truncateErrorMessage(error: string): string {
  if (error.length <= 500) return error;

  return error.substring(0, 497) + "...";
}
