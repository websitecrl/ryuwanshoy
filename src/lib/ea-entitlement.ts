import 'server-only'

/**
 * Decides whether the current reader is allowed to see Early Access content.
 *
 * THIS IS A PLACEHOLDER. The actual rule for "who gets early access" has not
 * been decided yet (private link/code sent to signups? donor perk? something
 * else?). Until that's decided, this ALWAYS returns false — meaning EA
 * content stays inaccessible to everyone, even if NEXT_PUBLIC_EARLY_ACCESS_ENABLED
 * gets flipped back to true.
 *
 * This is intentional and safe: it's the single place the real rule will go
 * once decided, instead of that logic being scattered across routes. Every
 * caller of this function already assumes "no" is the correct answer today.
 *
 * @param request - the incoming request, so a real rule can later read
 *                   cookies, query params, headers, etc. as needed
 */
export async function checkEarlyAccessEntitlement(
  request: Request
): Promise<boolean> {
  // TODO: replace with the real rule once decided.
  // Example shapes this might take later:
  //   - check a signed cookie set after redeeming an EA link/code
  //   - check a token in the query string against the early_access table
  //   - check a donor/session flag
  void request // referenced so the param isn't flagged as unused until then

  return false
}