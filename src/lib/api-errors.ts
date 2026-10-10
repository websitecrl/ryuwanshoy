import 'server-only'
import { NextResponse } from 'next/server'

/**
 * Logs an unexpected server-side failure and returns a generic 500.
 *
 * The real error (often a Postgres message naming tables, columns or
 * constraints) goes to the Workers logs only; the client gets `message`,
 * which is safe to show in a toast.
 *
 * @param where - route label for the logs, e.g. 'GET /api/comments'
 * @param err - the caught or returned error; logged as-is
 * @param message - user-facing text for the `{ error }` body
 * @returns a 500 response in the API's `{ error: string }` shape
 */
export function serverError(where: string, err: unknown, message: string) {
  console.error(`[${where}]`, err)
  return NextResponse.json({ error: message }, { status: 500 })
}
