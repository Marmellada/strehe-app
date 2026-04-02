// components/auth/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
    >
      Logout
    </button>
  );
}
