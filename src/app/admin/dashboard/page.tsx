'use client';

import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Sidebar } from '@/components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';

interface StatsCard {
  title: string;
  value: number;
  icon: string;
  change?: number | null;
  loading?: boolean;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string;
  user_role: string;
  action: string;
  resource: string;
  details: string;
  ip_address: string | null;
  status: string;
  timestamp: string;
}

// Helper function untuk mendapatkan warna border berdasarkan action
const getActivityColor = (action: string): string => {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('register')) {
    return 'border-green-500';
  } else if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
    return 'border-blue-500';
  } else if (actionLower.includes('delete') || actionLower.includes('remove')) {
    return 'border-red-500';
  } else if (actionLower.includes('login') || actionLower.includes('logout') || actionLower.includes('auth')) {
    return 'border-purple-500';
  } else if (actionLower.includes('approve') || actionLower.includes('accept')) {
    return 'border-green-500';
  } else if (actionLower.includes('reject') || actionLower.includes('deny')) {
    return 'border-orange-500';
  }
  return 'border-gray-500';
};

// Helper function untuk format waktu relative
const getRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const logTime = new Date(timestamp);
  const diffMs = now.getTime() - logTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return logTime.toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper function untuk format activity message
const formatActivityMessage = (log: AuditLog): string => {
  const action = log.action;
  const resource = log.resource;
  const userName = log.user_name;
  
  return `${userName} ${action.toLowerCase()} ${resource}`;
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<StatsCard[]>([
    { title: 'Total Patients', value: 0, icon: '🐾', change: null, loading: true },
    { title: 'Active Doctors', value: 0, icon: '👨‍⚕️', change: null, loading: true },
    { title: 'Pending Corrections', value: 0, icon: '📝', change: null, loading: true },
    { title: 'Medical Records', value: 0, icon: '📋', change: null, loading: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<AuditLog[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'admin') {
      router.push('/login');
    }

    fetchDashboardStats();

    const intervalid = setInterval(() => {
      fetchRecentActivities();
    }, 60000);

    return () => clearInterval(intervalid);
  }, [user, router]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch all stats in parallel
      const [patientsRes, doctorsRes, correctionsRes, recordsRes] = await Promise.all([
        fetch('/api/patients', { credentials: 'include' }).catch(() => null),
        fetch('/api/doctors', { credentials: 'include' }).catch(() => null),
        fetch('/api/corrections', { credentials: 'include' }).catch(() => null),
        fetch('/api/medical-records', { credentials: 'include' }).catch(() => null),
      ]);

      const patientsData = patientsRes?.ok ? await patientsRes.json() : { patients: [] };
      const doctorsData = doctorsRes?.ok ? await doctorsRes.json() : { doctors: [] };
      const correctionsData = correctionsRes?.ok ? await correctionsRes.json() : { corrections: [] };
      const recordsData = recordsRes?.ok ? await recordsRes.json() : { records: [] };

      // Count pending corrections
      const pendingCorrections = correctionsData.corrections?.filter(
        (c: any) => c.status === 'pending'
      ).length || 0;

      // Update stats - change is null (won't be displayed)
      // If you have historical data API, you can calculate change here
      setStats([
        {
          title: 'Total Patients',
          value: patientsData.patients?.length || 0,
          icon: '🐾',
          change: null, // Set to null if no historical data
          loading: false,
        },
        {
          title: 'Active Doctors',
          value: doctorsData.doctors?.length || 0,
          icon: '👨‍⚕️',
          change: null,
          loading: false,
        },
        {
          title: 'Pending Corrections',
          value: pendingCorrections,
          icon: '📝',
          change: null,
          loading: false,
        },
        {
          title: 'Medical Records',
          value: recordsData.records?.length || 0,
          icon: '📋',
          change: null,
          loading: false,
        },
      ]);

      // Fetch recent activities after stats loaded
      await fetchRecentActivities();

    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
      
      // Set loading to false even on error
      setStats(prev => prev.map(stat => ({ ...stat, loading: false })));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      setActivitiesLoading(true);
      
      const res = await fetch('/api/audit-logs?limit=10&sort=desc', {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      
      const data = await res.json();
      console.log('Recent activities:', data.logs);
      
      setRecentActivities(data.logs || []);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      toast.error('Failed to load recent activities');
      setRecentActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user.name}! Overview of your clinic.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 text-4xl opacity-50">
                  {stat.icon}
                </div>
                <div className="p-6">
                  <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wide">{stat.title}</h3>
                  {stat.loading ? (
                    <div className="mt-2 flex items-center">
                      <Loader className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl font-bold mt-2 text-gray-900">{stat.value}</p>
                      {/* Only show change if it's not null */}
                      {stat.change !== null && stat.change !== undefined && (
                        <div className={`mt-2 text-sm flex items-center ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-1">{stat.change >= 0 ? '↑' : '↓'}</span>
                          {Math.abs(stat.change)} from last month
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50">
                <div
                  className="flex items-center gap-4"
                  onClick={() => router.push('/admin/add-patient')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push('/admin/add-patient')}
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">🐾</div>
                  <div>
                    <h3 className="font-semibold">Add Patient</h3>
                    <p className="text-sm text-gray-600">Register new pet patient</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50">
                <div
                  className="flex items-center gap-4"
                  onClick={() => router.push('/admin/generate-qr')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push('/admin/generate-qr')}
                >
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">📱</div>
                  <div>
                    <h3 className="font-semibold">Generate QR Code</h3>
                    <p className="text-sm text-gray-600">Create QR codes for patients</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-gray-50">
                <div
                  className="flex items-center gap-4"
                  onClick={() => router.push('/admin/doctors')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push('/admin/doctors')}
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">👨‍⚕️</div>
                  <div>
                    <h3 className="font-semibold">Add Doctor</h3>
                    <p className="text-sm text-gray-600">Register new doctor</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="mt-8">
            <Card className="overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <button 
                    onClick={() => router.push('/admin/logs')}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View All
                  </button>
                </div>
                
                {activitiesLoading ? (
                  <div className="text-center py-8">
                    <Loader className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                    <p className="text-gray-600 mt-2">Loading activities...</p>
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No recent activities found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.slice(0, 5).map((log) => (
                      <div 
                        key={log.id} 
                        className={`border-l-4 ${getActivityColor(log.action)} pl-4 py-2 hover:bg-gray-50 transition-colors rounded-r`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {formatActivityMessage(log)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {log.details}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">
                                {getRelativeTime(log.timestamp)}
                              </span>
                              <span className="text-xs text-gray-400">
                                Role: {log.user_role}
                              </span>
                              {log.status === 'failed' && (
                                <span className="text-xs text-red-600 font-medium">
                                  Failed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    );
}
