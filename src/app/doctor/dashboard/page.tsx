'use client';

import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Sidebar } from '@/components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Patient {
  id: number;
  name: string;
  species: string;
  breed: string;
  last_visit?: string;
  status?: 'healthy' | 'treatment' | 'critical';
}

interface DashboardStats {
  todayPatients: number;
  pendingRecords: number;
  criticalCases: number;
  completedToday: number;
}

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayPatients: 0,
    pendingRecords: 0,
    criticalCases: 0,
    completedToday: 0,
  });
  const [todayPatients, setTodayPatients] = useState<Patient[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'doctor') {
      router.push('/login');
    }

    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch statsistics
      const statsResponse = await fetch('/api/doctor-stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch today's patients
      const patientsResponse = await fetch('/api/patients?limit=10&sort=recent');
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        setTodayPatients(patientsData.patients || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-700';
      case 'treatment': return 'bg-yellow-100 text-yellow-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'No recent visit';
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false , timeZone: 'Asia/Jakarta' }) + ' WIB';
  }

  if (!user || user.role !== 'doctor') {
    return null;
  }

  const statsCards = [
    { title: "Today's Patients", value: stats.todayPatients.toString(), icon: '🐾', color: 'bg-blue-100 text-blue-700' },
    { title: 'Pending Records', value: stats.pendingRecords.toString(), icon: '📋', color: 'bg-yellow-100 text-yellow-700' },
    { title: 'Critical Cases', value: stats.criticalCases.toString(), icon: '⚠️', color: 'bg-red-100 text-red-700' },
    { title: 'Completed Today', value: stats.completedToday.toString(), icon: '✅', color: 'bg-green-100 text-green-700' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Doctor Dashboard</h1>
          <p className="text-gray-600">Welcome back, Dr. {user.name}! Here's your overview for today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <Card key={index} className="relative overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.title}</p>
                    <p className="text-3xl font-bold mt-1">{loading ? '...' : stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${stat.color} flex items-center justify-center text-2xl`}>
                    {stat.icon}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Patients */}
        <Card className="overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Patients</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading patients...</div>
            ) : todayPatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No recent patients</div>
            ) : (
            <div className="space-y-4">
              {todayPatients.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {patient.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{patient.name}</p>
                      <p className="text-sm text-gray-600">{patient.species} - {patient.breed}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-gray-600">{formatTime(patient.last_visit)}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.status || '')}`}>
                      {patient.status || 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}</div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor/medical-records')}>
            <div className="text-center">
              <div className="text-4xl mb-2">📋</div>
              <h3 className="font-semibold text-gray-900">New Medical Record</h3>
              <p className="text-sm text-gray-600 mt-1">Create a new patient record</p>
            </div>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor/patients')}>
            <div className="text-center">
              <div className="text-4xl mb-2">🔍</div>
              <h3 className="font-semibold text-gray-900">Search Patients</h3>
              <p className="text-sm text-gray-600 mt-1">Find patient history</p>
            </div>
          </Card>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor/history')}>
            <div className="text-center">
              <div className="text-4xl mb-2">📅</div>
              <h3 className="font-semibold text-gray-900">Review Tasks</h3>
              <p className="text-sm text-gray-600 mt-1">Review pending records and follow-ups</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
