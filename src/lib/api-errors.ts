import 'server-only'
import { NextResponse } from 'next/server'

/** real error -> logs; client -> generic 500 message */
export function serverError(where: string, err: unknown, message: string) {
  console.error(`[${where}]`, err)
  return NextResponse.json({ error: message }, { status: 500 })
}
