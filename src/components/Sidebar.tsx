'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Home, 
  FileText, 
  Users, 
  History, 
  UserPlus, 
  QrCode, 
  LogOut, 
  Stethoscope,
  Settings,
  BarChart3,
  Activity,
  Edit3
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon: any;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;
  const menuItems: Record<string, MenuItem[]> = {
    admin: [
      { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
      { id: 'patients', label: 'Patients', href: '/admin/patients', icon: Users },
  { id: 'doctors', label: 'Doctors', href: '/admin/doctors', icon: Stethoscope },
      { id: 'corrections', label: 'Corrections', href: '/admin/corrections', icon: Edit3 },
      { id: 'generate-qr', label: 'Generate QR', href: '/admin/generate-qr', icon: QrCode },
        { id: 'logs', label: 'System Logs', href: '/admin/logs', icon: Activity }
    ],
    doctor: [
      { id: 'dashboard', label: 'Dashboard', href: '/doctor/dashboard', icon: BarChart3 },
      { id: 'patients', label: 'Patients', href: '/doctor/patients', icon: Users },
      { id: 'records', label: 'Medical Records', href: '/doctor/medical-records', icon: FileText },
      { id: 'history', label: 'Patient History', href: '/doctor/history', icon: History },
      { id: 'corrections', label: 'Corrections', href: '/doctor/corrections', icon: Edit3 }
    ],
    'pet-owner': [
      { id: 'home', label: 'Home', href: '/', icon: Home }
    ]
  };

  let items = menuItems[user.role] || menuItems['pet-owner'];

  // Fallback safety: jika role doctor tapi item patients tidak ada, inject.
  if (user.role === 'doctor' && !items.find(i => i.id === 'patients')) {
    items = [
      { id: 'patients', label: 'Patients', href: '/doctor/patients', icon: Users },
      ...items
    ];
  }

  const getRoleInfo = () => {
    switch (user.role) {
      case 'admin':
        return { name: 'Administrator', icon: '⚙️', color: 'bg-purple-100 text-purple-700' };
      case 'doctor':
        return { name: 'Veterinarian', icon: '🩺', color: 'bg-green-100 text-green-700' };
      default:
        return { name: 'User', icon: '👤', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const roleInfo = getRoleInfo();

  return (
    <aside className="bg-gray-800 text-white w-64 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600">
            <span className="text-xl">🐾</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">PetCare Clinic</p>
            <p className="text-xs text-gray-400">Veterinary System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4">
        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigation</p>
        </div>
        <nav className="space-y-1 px-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-700 p-4 space-y-2">
        {/* User Info */}
        <div className="flex items-center space-x-3 px-3 py-2">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${roleInfo.color}`}>
            <span className="text-lg">{roleInfo.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-xs text-gray-400 capitalize">{roleInfo.name}</p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}