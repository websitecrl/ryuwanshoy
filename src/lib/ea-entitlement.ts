import 'server-only'

/** Whether this reader may see Early Access content. Placeholder: always false until the rule is decided. */
export async function checkEarlyAccessEntitlement(
  request: Request
): Promise<boolean> {
  // TODO: the real rule (EA link cookie, token, or donor flag).
  void request

  return false
}