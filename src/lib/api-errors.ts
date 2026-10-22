import 'server-only'
import { NextResponse } from 'next/server'

/** Logs the real error (it can name tables and columns) and returns a generic 500 with a safe message. */
export function serverError(where: string, err: unknown, message: string) {
  console.error(`[${where}]`, err)
  return NextResponse.json({ error: message }, { status: 500 })
}
