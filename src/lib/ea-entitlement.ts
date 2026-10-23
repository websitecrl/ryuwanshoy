import 'server-only'

/** may this reader see EA content? placeholder: always false */
export async function checkEarlyAccessEntitlement(
  request: Request
): Promise<boolean> {
  // TODO: the real rule (EA link cookie, token, or donor flag).
  void request

  return false
}