'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const isAuthEnabled = typeof window !== 'undefined' && document.querySelector('[data-auth-enabled="true"]');

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthEnabled) {
      setIsLoading(false);
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = () => {
      const authCookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('feminism-class-auth='));
      
      const isAuth = authCookie?.split('=')[1] === 'authenticated';
      setIsAuthenticated(isAuth);
      setIsLoading(false);

      if (!isAuth && pathname !== '/login') {
        router.push('/login');
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
