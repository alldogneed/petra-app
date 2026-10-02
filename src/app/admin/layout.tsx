// The legacy Master Admin panel was merged into the platform panel at /owner.
// Every page under /admin is now a redirect; access control is enforced by the
// destination layout (src/app/owner/layout.tsx) and by each API route.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
