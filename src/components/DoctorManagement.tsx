'use client';

import React, { useState, useEffect, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Search, UserPlus, Edit, Trash2, Stethoscope, Phone, Award, FileText, X, UserCheck, UserX, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { join } from 'path/win32';

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  license_number: string;
  status: 'active' | 'inactive';
  join_date: string;
}

export function DoctorManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    license_number: '',
    password: '',
  });

  // Fetch doctors on component mount
  useEffect(() => {
    fetchDoctors();
  }, []);

  // Fetch all doctors from API
  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/doctors', {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch doctors');
      }
      
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (error: any) {
      console.error('Error fetching doctors:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load doctors');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter doctors based on search query
  const filteredDoctors = doctors.filter(doctor =>
    doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle add doctor form submission
  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    if (!formData.name || !formData.email || !formData.phone || !formData.specialization || !formData.license_number || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
    
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add doctor');
      }

      toast.success('Doctor added successfully');
      setShowAddModal(false);

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        specialization: '',
        license_number: '',
        password: '',
      });

      // Refresh doctor list
      await fetchDoctors();
    } catch (error: any) {
      console.error('Error adding doctor:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add doctor');
    }
  };

  // Handle delete doctor
  const handleDeleteDoctor = async (id: string) => {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to remove this doctor? This action cannot be undone.')) {
      return;
    }

    // User confirmed, proceed with deletion
    try {
      const res = await fetch(`/api/doctors?id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete doctor');
      }

      toast.success('Doctor deleted successfully');

      // Refresh doctor list
      await fetchDoctors();
    } catch (error: any) {
      console.error('Error deleting doctor:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete doctor');
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
      const res = await fetch('/api/doctors/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      toast.success(`Doctor ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);

      // Refresh doctor list
      await fetchDoctors();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  // LoadingDots component
  const LoadingDots: React.FC = () => {
    const [dots, setDots] = useState('');

    useEffect(() => {
      const interval = setInterval(() => {
        setDots(prevDots => {
          if (prevDots.length >= 3) {
            return ''; // Reset ke 0 titik
          }
          return prevDots + '.'; // Tambah 1 titik
        });
      }, 200); // Ganti titik setiap 100ms

      // Cleanup function untuk membersihkan interval saat komponen dilepas
      return () => clearInterval(interval);
    }, []);

    // Catatan: Menggunakan &nbsp; (non-breaking space) memastikan lebar tidak goyang saat titik menghilang
    return (
      <span className="inline-block w-4 text-left text-gray-600">
        {dots}
        {/* Tambahkan spasi untuk mengisi ruang yang hilang saat titik kurang dari 3 */}
        {Array(3 - dots.length).fill('\u00A0').map((char, index) => (
          <React.Fragment key={index}>{char}</React.Fragment>
        ))}
      </span>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div className="mt-3 flex items-center text-gray-600">
            <span>Loading</span>
            <LoadingDots />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Doctor Management</h1>
          <p className="text-gray-500 mt-1">Manage veterinarian accounts, licenses, and specialization.</p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)} 
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all text-white flex items-center gap-2 px-6 py-2.5 rounded-full"
        >
          <UserPlus className="w-4 h-4" />
          Add New Doctor
        </Button>
      </div>

      {/* STAT CARDS */}
      {/* Kita hitung stat secara inline dari data yang ada */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
            <div>
                <p className="text-sm font-medium text-gray-500">Total Doctors</p>
                <p className="text-2xl font-bold text-blue-700">{filteredDoctors.length}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                <Stethoscope className="w-5 h-5" />
            </div>
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
            <div>
                <p className="text-sm font-medium text-gray-500">Active Status</p>
                <p className="text-2xl font-bold text-green-700">
                  {filteredDoctors.filter(d => d.status === 'active').length}
                </p>
            </div>
            <div className="p-3 rounded-full bg-green-50 text-green-600">
                <UserCheck className="w-5 h-5" />
            </div>
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-gray-300 shadow-sm hover:shadow-md transition-all">
            <div>
                <p className="text-sm font-medium text-gray-500">Inactive/Leave</p>
                <p className="text-2xl font-bold text-gray-700">
                  {filteredDoctors.filter(d => d.status !== 'active').length}
                </p>
            </div>
            <div className="p-3 rounded-full bg-gray-100 text-gray-600">
                <UserX className="w-5 h-5" />
            </div>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="p-2 sticky top-4 z-10 shadow-sm border-gray-200 bg-white/95 backdrop-blur-sm">
         <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                placeholder="Search by name, license ID, or specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-none focus:ring-0 bg-transparent placeholder:text-gray-400 outline-none"
            />
         </div>
      </Card>

      {/* Doctors Table */}
      <Card className="overflow-hidden border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>Registered Doctors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase trackingw-wider text-gray-500 font-semibold">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Contact</th>
                  <th className="py-4 px-6">Specialization</th>
                  <th className="py-4 px-6">License & Join Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDoctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-blue-50/30 transition-colors group">
                    {/*Name*/}
                    <td className="py-4 px-6 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 rounded-full flex items-center justify-center text-blue-700 shadow-inner">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900">{doctor.name}</p>
                          <p className="text-sm text-gray-500">{doctor.email}</p>
                        </div>
                      </div>
                    </td>
                    {/*Contact*/}
                    <td className="py-4 px-6 align-middle">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{doctor.phone}</span>
                      </div>
                    </td>
                    {/*Specialization*/}
                    <td className="py-4 px-6 align-middle">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-sm font-medium border border-purple-100">
                        <Activity className="w-3 h-3" />
                        {doctor.specialization}
                      </div>
                    </td>
                    {/*License Number & Date*/}
                    <td className="py-4 px-6 align-middle">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded w-fit">
                          <FileText className="w-3 h-3 text-gray-400" />
                          {doctor.license_number}
                        </div>
                        <p className="text-[10px] text-gray-400 pl-1">
                          Joined: {new Date(doctor.join_date).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    {/*Status*/}
                    <td className="py-4 px-5 align-middle">
                      <Badge
                        className={ `px-2.5 py-0.5 text-xs font-semibold border ${
                          doctor.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {doctor.status}
                      </Badge>
                    </td>
                    {/*Action*/}
                    <td className="py-4 px-8 align-middle">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStatus(doctor.id, doctor.status)}
                          className={`p-2 rounded-full transition-colors ${
                              doctor.status == 'active' 
                              ? 'text-orange-500 hover:bg-orange-50 hover:text-orange-700'
                              : 'text-green-600 hover:bg-green-50 hover:text-green-800'
                            }`}
                          title={doctor.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                            {doctor.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4"/>}
                        </button>

                        <div className="w-px h-4 bg-gray-200"></div>

                        <button
                          onClick={() => {/* Tambahkan fungsi edit di sini jika ada */}}
                          className="p-2 text-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded-full transition-colors"
                          title="Edit Details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoctor(doctor.id)}
                          className="text-red-500 hover:bg-red-50 hover:text-red-800 rounded-full transition-colors"
                          title="Delete Doctor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredDoctors.length === 0 && (
            <div className="text-center py-12">
              <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">{searchQuery ? 'No doctors found for your search.' : 'No doctors registered yet.'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl bg-white shadow-2xl rounded-xl overflow-hidden">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add New Doctor</h2>
                  <p className="text-sm text-gray-500">Create a new veterinarian account</p>
                </div>
              </div>
              <button 
                title="Add" 
                onClick={() => setShowAddModal(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CardContent className="p-6 mt-4">
              <form onSubmit={handleAddDoctor} className="space-y-5">
                {/* Personal Info Group */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4"/> Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name<span className="text-red-500">*</span></label>
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Dr. John Doe"
                        required
                        className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email<span className="text-red-500">*</span></label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="doctor@vetclinic.com"
                        required
                        className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone<span className="text-red-500">*</span></label>
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+62-823-1234-5678"
                        required
                        className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Professional Info Group */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4"/> Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization<span className="text-red-500">*</span></label>
                      <Input
                        type="text"
                        value={formData.specialization}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        placeholder="General Practice"
                        required
                        className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">License Number<span className="text-red-500">*</span></label>
                      <Input
                        type="text"
                        value={formData.license_number}
                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                        placeholder="VET-2024-XXX"
                        required
                        className="bg-gray-50 border-gray-200 focus:bg-white transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <label className="block text-sm font-bold text-blue-800 mb-1.5">Password<span className="text-red-500">*</span></label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Create a strong password"
                    required
                    minLength={8}
                    className="bg-white border blue-200 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-gray-600/70 mt-1 flex items-center gap-1">
                    <Activity className="w-3 h-3"/>
                    Min. 8 chars, uppercase, lowercase, number & symbol required.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
                    Add Doctor
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({
                        name: '', email: '', phone: '', specialization: '', license_number: '', password: '',
                      });
                    }}
                    className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
