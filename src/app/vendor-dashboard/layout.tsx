'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { LayoutDashboard, PackageSearch, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Basic AuthGuard logic
    if (!isAuthenticated || user?.role !== 'vendor') {
      router.replace('/login');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== 'vendor') {
    return null; // Return null while redirecting
  }

  const navLinks = [
    { href: '/vendor-dashboard', label: 'My Leads', icon: LayoutDashboard },
    { href: '/vendor-dashboard/catalog', label: 'My Catalog', icon: PackageSearch },
    { href: '/vendor-dashboard/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Vendor CRM</h1>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'V'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 pb-24">
        {children}
      </main>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe sm:hidden">
        <div className="flex justify-around items-center h-16">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <Icon size={20} className={isActive ? 'stroke-[2.5px]' : ''} />
                <span className="text-[10px] font-medium">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation (Optional/Hidden on Mobile) */}
      {/* If we wanted a desktop sidebar, we'd add it here with sm:flex */}
    </div>
  );
}
