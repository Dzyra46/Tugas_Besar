'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Search, FileText, Calendar, Plus, Edit2, Trash2, X } from 'lucide-react';
import { Button } from './ui/Button';
import { toast } from 'sonner';
import { PatientSelector } from './PatientSelector';

interface MedicalRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  user_id: string;
  visit_date: string;
  weight?: number;
  diagnosis: string;
  treatment: string;
  medication: string;
  notes?: string;
  next_visit?: string;
  blockchain_hash?: string;
  blockchain_tx_id?: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  patientId: string;
  visitDate: string;
  weight: string;
  diagnosis: string;
  treatment: string;
  medication: string;
  notes: string;
  nextVisit: string;
}

export function MedicalRecords() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [corrections, setCorrections] = useState<any[]>([]);
  
  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    patientId: '',
    visitDate: new Date().toISOString().slice(0, 10),
    weight: '',
    diagnosis: '',
    treatment: '',
    medication: '',
    notes: '',
    nextVisit: '',
  });

  // Fetch records on mount
  useEffect(() => {
    fetchRecords();
    fetchCorrections();
  }, []);

  // Filter records when search/status changes
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredRecords(
      records.filter(r => {
        const matchText =
          r.diagnosis.toLowerCase().includes(q) ||
          r.treatment.toLowerCase().includes(q) ||
          r.medication.toLowerCase().includes(q);
        return matchText;
      })
    );
  }, [searchQuery, statusFilter, records]);

  // Fetch records from API
  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/medical-records', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengambil data');
      }

      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal mengambil data medical records');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCorrections = async () => {
    try {
      const res = await fetch('/api/corrections?status=approved', {
        credentials: 'include',
      });
      const data = await res.json();
      setCorrections(data.corrections || []);
    } catch (error) {
      console.error('Failed to fetch corrections:', error);
    }
  };

  // Handle create/edit form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.patientId || !formData.diagnosis || !formData.treatment || !formData.visitDate) {
        toast.error('Semua field harus diisi');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        patientId: formData.patientId,
        doctorId: user?.user_id || user?.id, // AUTO-FILL from authenticated user
        visitDate: formData.visitDate,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        diagnosis: formData.diagnosis,
        treatment: formData.treatment,
        medication: formData.medication,
        notes: formData.notes || undefined,
        nextVisit: formData.nextVisit || undefined,
      };

      const url = editingId ? `/api/medical-records` : `/api/medical-records`;
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId
        ? { id: editingId, ...payload }
        : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Gagal ${editingId ? 'update' : 'create'} record`);
      }

      toast.success(`Record berhasil di${editingId ? 'update' : 'buat'}`);
      
      // Reset form & close modal
      setFormData({
        patientId: '',
        visitDate: new Date().toISOString().slice(0, 10),
        weight: '',
        diagnosis: '',
        treatment: '',
        medication: '',
        notes: '',
        nextVisit: '',
      });
      setEditingId(null);
      setShowForm(false);

      // Refresh records
      await fetchRecords();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(errorMessage);
      toast.error(`❌ ${errorMessage}`);
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus record ini?')) {
      return;
    }

    try {
      const res = await fetch(`/api/medical-records?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus record');
      }

      toast.success('Record berhasil dihapus');
      await fetchRecords();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus record');
    }
  };

  // Handle edit
  const handleEdit = (record: MedicalRecord) => {
    setFormData({
      patientId: record.patient_id,
      visitDate: record.visit_date,
      weight: record.weight ? record.weight.toString() : '',
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      medication: record.medication,
      notes: record.notes || '',
      nextVisit: record.next_visit || '',
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  // Reset form & close modal
  const closeModal = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      patientId: '',
      visitDate: new Date().toISOString().slice(0, 10),
      weight: '',
      diagnosis: '',
      treatment: '',
      medication: '',
      notes: '',
      nextVisit: '',
    });
  };

  const counts = {
    all: records.length,
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
  
        {/* Bagian Kiri: Judul & Konteks */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Medical Records
            </h1>
            
            {/* Badge Total Count */}
            <span className="px-2.5 py-0.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
              Records: {counts.all}
            </span>
          </div>
          
          <p className="text-sm text-gray-500">
            Manage patient history, diagnoses, and treatments.
          </p>
        </div>

        {/* Bagian Kanan: Tombol Aksi */}
        <div className="flex items-center gap-3">
          {/* (Opsional) Tempat untuk Search/Filter bisa diletakkan di sini nanti */}
          
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 flex items-center gap-2 px-5"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">New Record</span>
          </Button>
        </div>

      </div>

      {/* Search */}
      <div className="mb-5 flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search diagnosis / treatment / medication..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Records List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-gray-500 text-sm mt-4">Loading records...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRecords.map((record) => (
            <Card 
              key={record.id} 
              className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500 overflow-hidden"
            >
              <div className="p-5 space-y-5">
                
                {/* --- HEADER SECTION: Diagnosis & Actions --- */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {record.diagnosis}
                      </h3>
                      {/* Badge Correction */}
                      {corrections.some(c => c.record_id === record.id && c.status === 'approved') && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 rounded-full border border-yellow-200">
                          Corrected
                        </span>
                      )}
                    </div>
                    
                    {/* Meta Information Row (Patient ID & Doctor ID) */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span 
                        className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded cursor-help"
                        title={`Patient ID: ${record.patient_id}`}
                      >
                        <span className="font-semibold text-gray-400">PATIENT:</span> 
                        <span className="font-mono text-gray-700">
                          {record.patient_name || record.patient_id.slice(0, 8) + '...'}
                        </span>
                      </span>
                      {record.user_id && (
                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                          <span className="font-semibold text-gray-400">DOC:</span> 
                          <span className="font-mono text-gray-700">{record.user_id.slice(0, 8)}...</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(record)}
                      className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-full transition-colors"
                      title="Edit Record"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-full transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* --- DATES SECTION --- */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Visit Date</span>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span>
                        {new Date(record.visit_date).toLocaleDateString('id-ID', {
                          day: '2-digit', month: 'long', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {record.next_visit && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Next Visit</span>
                      <div className="flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-50 w-fit px-2 py-0.5 rounded-md">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(record.next_visit).toLocaleDateString('id-ID', {
                            day: '2-digit', month: 'long', year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* --- MAIN CONTENT (Grid Layout for Desktop) --- */}
                <div className="grid md:grid-cols-2 gap-4">
                    
                    {/* Treatment Box */}
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-blue-600 mb-1">Treatment</p>
                        <p className={`text-sm text-gray-700 leading-relaxed ${expanded[record.id] ? '' : 'line-clamp-3'}`}>
                          {record.treatment}
                        </p>
                    </div>

                    {/* Medication Box */}
                    <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-green-600 mb-1">Medication</p>
                        <p className={`text-sm text-gray-700 leading-relaxed ${expanded[record.id] ? '' : 'line-clamp-3'}`}>
                          {record.medication}
                        </p>
                    </div>
                </div>

                {/* Notes Section (Full Width) */}
                {record.notes && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Notes</p>
                    <div className="flex gap-2">
                        <div className="w-1 bg-gray-200 rounded-full shrink-0"></div>
                        <p className="text-sm text-gray-600 italic">{record.notes}</p>
                    </div>
                  </div>
                )}

                {/* --- FOOTER: Expand Toggle --- */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(record.id)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    {expanded[record.id] ? 'Show less' : 'Show details'}
                  </button>
                </div>

              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredRecords.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No medical records found</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingId ? 'Edit Medical Record' : 'Create Medical Record'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Patient ID *</label>
                <Input
                  type="text"
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  placeholder="e.g., P-001 or UUID"
                  required
                />
              </div>

              {/* Doctor ID is automatically filled from authenticated user session */}
              
              <PatientSelector
                onSelect={(id) => setFormData({ ...formData, patientId: id })}
                selectedId={formData.patientId}
              />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Visit Date *
                </label>
                <Input
                  type="date"
                  value={formData.visitDate}
                  onChange={(e) =>
                    setFormData({ ...formData, visitDate: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Weight (kg)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="e.g., 15.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Berat badan saat kunjungan (akan ditimbang oleh tim medis)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Diagnosis *
                </label>
                <Input
                  type="text"
                  value={formData.diagnosis}
                  onChange={(e) =>
                    setFormData({ ...formData, diagnosis: e.target.value })
                  }
                  placeholder="e.g., Ear Infection"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Treatment *
                </label>
                <textarea
                  value={formData.treatment}
                  onChange={(e) =>
                    setFormData({ ...formData, treatment: e.target.value })
                  }
                  placeholder="e.g., Antibiotic drops, 2 weeks"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Medication *</label>
                <textarea
                  value={formData.medication}
                  onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                  placeholder="e.g., Amoxicillin 500mg, 2x daily for 7 days"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes..."
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Next Visit (optional)
                </label>
                <Input
                  type="date"
                  value={formData.nextVisit}
                  onChange={(e) =>
                    setFormData({ ...formData, nextVisit: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}