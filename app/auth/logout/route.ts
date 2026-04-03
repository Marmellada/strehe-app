// app/auth/logout/route.ts
import { createClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';

async function handleLogout(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL('/auth/login', request.url));
}

export async function POST(request: Request) {
  return handleLogout(request);
}

export async function GET(request: Request) {
  return handleLogout(request);
}