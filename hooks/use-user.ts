import type { User } from "@/types";

import { useSession } from "@/lib/auth/client";

export function useUser() {
  const { data: session, isPending, error } = useSession();

  // Transform BetterAuth session to our User type
  const user: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
      }
    : null;

  return {
    user,
    error: error ?? null,
    isLoading: isPending,
  };
}
