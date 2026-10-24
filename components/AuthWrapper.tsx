// Access control is enforced server-side in middleware.ts (httpOnly cookie).
export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
