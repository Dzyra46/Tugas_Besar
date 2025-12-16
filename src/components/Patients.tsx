import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Search, Dog, Cat, Bird, Edit, Trash2, Plus, PawPrint, Heart, Stethoscope, AlertCircle, Activity, Calendar, Weight, User, Phone, X, Mail, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/Avatar';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface Patient {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  age: number;
  owner: string;
  contact: string;
  visit_date?: string;
  status: 'healthy' | 'under-treatment' | 'critical';
  qr_code?: string;
  weight: number;
  assigned_doctor_id?: string; // TAMBAHKAN
  assigned_doctor_user_id?: string; // TAMBAHKAN (dari view)
}

interface PatientFormData {
  petName: string;
  species: string;
  breed: string;
  age: string;
  weight: string;
  birthDate: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  status: string;
  notes: string;
}

export function Patients() {
  const { user } = useAuth(); 
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PatientFormData>({
    petName: '',
    species: '',
    breed: '',
    age: '',
    weight: '',
    birthDate: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    status: 'healthy',
    notes: '',
  });
  
  // Fetch patients on component mount
  useEffect(() => {
    fecthPatients();
  }, []);

  // Fetch all patients from API
  const fecthPatients = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch patients');
      }

      const data = await res.json();
      setPatients(data.patients || []);
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load patients');
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate form data
  const validate = (): string[] => {
    const issues: string[] = [];
    if (!formData.petName.trim()) issues.push('Pet Name is required');
    if (!formData.species) issues.push('Species is required');
    if (!formData.breed.trim()) issues.push('Breed is required');
    if (!formData.ownerName.trim()) issues.push('Owner Name is required');
    if (!formData.ownerEmail.trim()) issues.push('Owner Email is required');
    if (!formData.ownerPhone.trim()) issues.push('Owner Phone is required');
    if (formData.age && Number(formData.age) < 0) issues.push('Age cannot be negative');
    if (formData.weight && Number(formData.weight) < 0) issues.push('Weight cannot be negative');
    return issues;
  };

  // Handle add patient submission
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const issues = validate();
    if (issues.length > 0) {
      toast.error(issues.join('\n'));
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.petName,
        species: formData.species,
        breed: formData.breed,
        age: formData.age ? Number(formData.age) : 0,
        weight: formData.weight ? Number(formData.weight) : 0,
        birth_date: formData.birthDate || null,
        owner: formData.ownerName,
        ownerEmail: formData.ownerEmail,
        contact: formData.ownerPhone,
        status: formData.status || 'healthy',
        notes: formData.notes || '',
      };

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add patient');
      }

      toast.success('Patient added successfully');
      setShowAddModal(false);

      // Reset form
      setFormData({
        petName: '',
        species: '',
        breed: '',
        age: '',
        weight: '',
        birthDate: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        status: 'healthy',
        notes: '',
      });

      // Refresh patient list
      await fecthPatients();
    } catch (error: any) {
      console.error('Error adding patient:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.species.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSpeciesIcon = (species: string) => {
    switch (species) {
      case 'dog':
        return <Dog className="w-5 h-5" />;
      case 'cat':
        return <Cat className="w-5 h-5" />;
      default:
        return <PawPrint className="w-5 h-5" />;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-green-100 text-green-700 border-green-200',
          border: 'border-l-green-500',
          icon: Heart,
          label: 'Healthy'
        };
      case 'under-treatment':
        return {
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          border: 'border-l-blue-500',
          icon: Stethoscope,
          label: 'Under Treatment'
        };
      case 'critical':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          border: 'border-l-red-500',
          icon: AlertCircle,
          label: 'Critical'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          border: 'border-l-gray-400',
          icon: Activity,
          label: status
        };
    }
  };

  // Format status text
  const formatStatusText = (status: string) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
      }, 100); // Ganti titik setiap 100ms

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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Patients</h1>
          <p className="text-gray-500 mt-1">Manage all registered patients</p>
        </div>
        {/* Header dengan tombol Add Patient - hanya untuk admin */}
        <div className="flex items-center justify-between mb-6">
          
          {/* CONDITIONAL RENDERING - hanya tampil untuk admin */}
          {user?.role === 'admin' && (
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Patient
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-gray-300 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Total</p>
              <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-full text-gray-600">
              <PawPrint className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-green-300 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Healthy</p>
              <p className="text-2xl font-bold text-green-800">{patients.filter(p => p.status === 'healthy').length}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full text-green-600">
              <Heart className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-blue-300 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Treatment</p>
              <p className="text-2xl font-bold text-blue-800">{patients.filter(p => p.status === 'under-treatment').length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-red-300 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Critical</p>
              <p className="text-2xl font-bold text-red-800">{patients.filter(p => p.status === 'critical').length}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-full text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Sticky Search Bar */}
      <Card className="p-2 sticky top-4 z-10 shadow-sm border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by patient name, owner, breed or species..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border-none focus:ring-0 bg-transparent placeholder:text-gray-400 outline-none"
          />
        </div>
      </Card>

      {/* Patients Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map((patient) => {
          const statusStyle = getStatusConfig(patient.status);

          return (
            <Card key={patient.id} className={`group hover:shadow-xl transition-all duration-200 overflow-hidden border-l-4 cursor-pointer ${statusStyle.border}`}>
              <CardHeader className="pb-3 bg-gray-50/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                      <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
                        {getSpeciesIcon(patient.species)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{patient.name}</CardTitle>
                      <p className="text-sm text-gray-500 capitalize">{patient.species} • {patient.breed}</p>
                    </div>
                  </div>
                  <Badge className={`px-2.5 py-0.5 text-sm font-semibold border ${statusStyle.color}`}>
                    {statusStyle.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Physical Stats Chips */}
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                    <Calendar className="w-3 h-3" /> 
                    Age: {patient.age ? `${patient.age} year${patient.age !== 1 ? 's' : ''}` : 'N/A'}
                  </div>
                  {patient.weight && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                      {/* <span className="text-sm text-gray-500">Weight</span> */}
                      <Weight className="w-3 h-3" /> Weight: {patient.weight} kg
                    </div>
                  )}
                  {patient.visit_date && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                      {/* <span className="text-sm text-gray-500">Last Visit</span> */}
                      <Activity className="w-3 h-3" />
                      Last visit: {new Date(patient.visit_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Owner Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-full">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Owner</span>
                      <span className="text-sm font-medium text-gray-900">{patient.owner}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                      <Phone className="w-4 h-4" /> {patient.contact}
                    </div>
                  </div>
                </div>
                {/* Badge untuk assigned doctor */}
                {patient.assigned_doctor_id && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    <User className="w-3 h-3 mr-1" />
                    Assigned
                  </Badge>
                )}
              </CardContent>
            </Card>
          )
        }
        )}
      </div>

      {/* Empty State */}
      {filteredPatients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-gray-50 p-6 rounded-full mb-4 animate-in zoom-in-50 duration-300">
            <PawPrint className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No patients found</h3>
          <p className="text-gray-500 max-w-sm mt-1">
            {searchQuery
              ? `We couldn't find any patients matching "${searchQuery}".`
              : "Get started by registering a new patient to the system."}
          </p>
        </div>
      )}
      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <PawPrint className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Add New Patient</h2>
                  <p className="text-sm text-gray-500">Register a new pet and owner information</p>
                </div>
              </div>
              <button
              title='Close Add Patient Modal'
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPatient} className="p-6 space-y-6">
              {/* Pet Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 border-b pb-2">
                  <PawPrint className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Pet Details</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pet Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="petName"
                      value={formData.petName}
                      onChange={handleChange}
                      placeholder="e.g., Max, Luna"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Species <span className="text-red-500">*</span>
                    </label>
                    <select
                      title='Select species'
                      name="species"
                      value={formData.species}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select species</option>
                      <option value="dog">Dog</option>
                      <option value="cat">Cat</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Breed <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="breed"
                      value={formData.breed}
                      onChange={handleChange}
                      placeholder="e.g., Golden Retriever"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age (years)
                    </label>
                    <Input
                      name="age"
                      type="number"
                      value={formData.age}
                      onChange={handleChange}
                      placeholder="Age in years"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (kg)
                    </label>
                    <Input
                      name="weight"
                      type="number"
                      step="0.1"
                      value={formData.weight}
                      onChange={handleChange}
                      placeholder="Weight in kg"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Birth Date
                    </label>
                    <Input
                      name="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Owner Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 border-b pb-2">
                  <User className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Owner Details</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Owner Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      placeholder="e.g., John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="ownerEmail"
                      type="email"
                      value={formData.ownerEmail}
                      onChange={handleChange}
                      placeholder="owner@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="ownerPhone"
                      type="tel"
                      value={formData.ownerPhone}
                      onChange={handleChange}
                      placeholder="08123456789"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      title='Select status'
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="healthy">Healthy</option>
                      <option value="under-treatment">Under Treatment</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      placeholder="Additional notes or medical history..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? 'Adding...' : 'Add Patient'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}