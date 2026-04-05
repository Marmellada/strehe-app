/**
 * Legacy placeholder.
 *
 * Contracts no longer create task automation records at creation time.
 * The scheduled generator reads subscriptions directly later through:
 * subscription -> package_services -> services -> tasks
 */
export async function setupContractAutomation(_subscriptionId: string) {
  return;
}