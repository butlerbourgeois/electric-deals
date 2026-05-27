import { NextRequest, NextResponse } from 'next/server'
import { lookupZipFromDb } from '@/lib/supabase/zip-lookup-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ zip: string }> }
) {
  const { zip } = await params
  const cleaned = zip.replace(/\D/g, '').slice(0, 5)

  if (cleaned.length !== 5) {
    return NextResponse.json({ error: 'Invalid ZIP' }, { status: 400 })
  }

  const result = await lookupZipFromDb(cleaned)

  if (!result) {
    return NextResponse.json({ error: 'ZIP not found in deregulated market' }, { status: 404 })
  }

  return NextResponse.json(result)
}
