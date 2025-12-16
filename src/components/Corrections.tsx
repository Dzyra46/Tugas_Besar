"use client";

import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import React from 'react';
import { addLog } from '@/lib/auditLog';

// Simple textarea wrapper (since ./ui/Textarea doesn't exist yet)
interface SimpleTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
function Textarea(props: SimpleTextareaProps) {
  return <textarea className={"border rounded-md w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 " + (props.className||'')} {...props} />;
}
import { Edit3, Check, X, Search, FileText, Clock, User, ArrowRight, AlertCircle, Filter } from 'lucide-react';

interface CorrectionRequest {
  id: string;
  record_id: string;
  patient_id: string;
  patient_name: string;
  doctor_name: string;
  field: string; // field to correct
  current_value: string;
  proposed_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  decided_at?: string;
  decided_by?: string;
}

interface MedicalRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  species: string;
  visit_date: string;
  diagnosis: string;
  treatment: string;
  medication: string;
  notes: string | null;
  next_visit: string | null;
  weight: number | null;
  doctor_name: string;
  specialization: string;
}

// Interface untuk field correction (multiple mode)
interface FieldCorrectionData {
  current_value: string;
  proposed_value: string;
}


interface CorrectionsProps {
  role: 'admin' | 'doctor';
  doctor_name?: string;
}

export function Corrections({ role, doctor_name }: CorrectionsProps) {
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  // Fetch corrections from API
  const fetchCorrections = async () => {
    let url = '/api/corrections';
    if (role === 'doctor' && doctor_name) {
      url += `?doctor=${encodeURIComponent(doctor_name)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    setCorrections(data.corrections || []);
  };

  // Fetch medical records untuk dropdown selection
  const fetchMedicalRecords = async () => {
    if (role !== 'doctor') return;
    
    try {
      const res = await fetch('/api/medical-records/list', {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch medical records');
      }
      
      const data = await res.json();
      setMedicalRecords(data.records || []);
    } catch (error) {
      console.error('Error fetching medical records:', error);
      alert('Failed to load medical records');
    }
  };

  useEffect(() => {
    fetchCorrections();
    if (role === 'doctor') {
      fetchMedicalRecords();
    }
  }, [role, doctor_name]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CorrectionRequest['status']>('all');
  const [formData, setFormData] = useState<{
    record_id: string;
    patient_id: string;
    patient_name: string;
    correctionMode: 'single' | 'multiple';
    field: string;
    current_value: string;
    proposed_value: string;
    fields: {
      diagnosis: FieldCorrectionData;
      medication: FieldCorrectionData;
      treatment: FieldCorrectionData;
      notes: FieldCorrectionData;
      next_visit: FieldCorrectionData;
    };
    reason: string;
  }>({
    record_id: '',
    patient_id: '',
    patient_name: '',
    correctionMode: 'single',
    field: '',
    current_value: '',
    proposed_value: '',
    fields: {
      diagnosis: { current_value: '', proposed_value: '' },
      medication: { current_value: '', proposed_value: '' },
      treatment: { current_value: '', proposed_value: '' },
      notes: { current_value: '', proposed_value: '' },
      next_visit: { current_value: '', proposed_value: '' },
    },
    reason: '',
  });

  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [availableFields] = useState<string[]>([
    'diagnosis',
    'medication',
    'treatment',
    'notes',
    'next_visit',
    'visit_date',
    'weight'
  ]);

  const filtered = corrections.filter(c => {
    const matchesSearch =
      (c.patient_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (c.patient_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (c.record_id?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a,b) => a.created_at < b.created_at ? 1 : -1);

  const getStatusColor = (status: CorrectionRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handler untuk memilih medical record
  const handleRecordSelect = (record_id: string) => {
    const record = medicalRecords.find(r => r.id === record_id);
    if (!record) return;

    setSelectedRecord(record);
    setFormData(prev => ({
      ...prev,
      record_id: record.id,
      patient_id: record.patient_id,
      patient_name: record.patient_name,
      // Reset single mode fields
      field: '',
      current_value: '',
      proposed_value: '',
      // Set multiple mode fields dengan current values
      fields: {
        diagnosis: { current_value: record.diagnosis || '', proposed_value: '' },
        medication: { current_value: record.medication || '', proposed_value: '' },
        treatment: { current_value: record.treatment || '', proposed_value: '' },
        notes: { current_value: record.notes || '', proposed_value: '' },
        next_visit: { current_value: record.next_visit || '', proposed_value: '' },
      }
    }));
  };

  // Handler untuk memilih field (single mode)
  const handleFieldSelect = (field: string) => {
    if (!selectedRecord) return;

    let current_value = '';
    
    // Ambil current value berdasarkan field
    switch (field) {
      case 'diagnosis':
        current_value = selectedRecord.diagnosis || '';
        break;
      case 'medication':
        current_value = selectedRecord.medication || '';
        break;
      case 'treatment':
        current_value = selectedRecord.treatment || '';
        break;
      case 'notes':
        current_value = selectedRecord.notes || '';
        break;
      case 'next_visit':
        current_value = selectedRecord.next_visit || '';
        break;
      case 'weight':
        current_value = selectedRecord.weight?.toString() || '';
        break;
      default:
        current_value = '';
    }

    setFormData(prev => ({
      ...prev,
      field,
      current_value,
      proposed_value: '' // Reset proposed value
    }));
  };

  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (formData.correctionMode === 'single') {
        // submit single field correction
        const payload = {
          record_id: formData.record_id,
          patient_id: formData.patient_id,
          patient_name: formData.patient_name,
          field: formData.field,
          current_value: formData.current_value,
          proposed_value: formData.proposed_value,
          reason: formData.reason,
        };

        const res = await fetch('/api/corrections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });
      
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to submit correction');
        }
      
      } else {
        // submit multiple field corrections
        const corrections = Object.entries(formData.fields)
          .filter(([_, values]) => values.proposed_value.trim() !== '')
          .map(([field, value]) => ({
            record_id: formData.record_id,
            patient_id: formData.patient_id,
            patient_name: formData.patient_name,
            field,
            current_value: value.current_value,
            proposed_value: value.proposed_value,
            reason: formData.reason,
          }));
        
        if (corrections.length === 0) {
          alert('Please fill at least one proposed value');
          return;
        }

        // Submit semua corrections
        const promises = corrections.map(payload =>
          fetch('/api/corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
          })
        );

        const results = await Promise.all(promises);
        const failedRequests = results.filter(r => !r.ok);
        
        if (failedRequests.length > 0) {
          throw new Error(`${failedRequests.length} correction(s) failed to submit`);
        }
      }
      
      // Success - refresh dan close modal
      await fetchCorrections();
      setShowForm(false);

      // Reset form
      setFormData({
        record_id: '',
        patient_id: '',
        patient_name: '',
        correctionMode: 'single',
        field: '',
        current_value: '',
        proposed_value: '',
        fields: {
          diagnosis: { current_value: '', proposed_value: '' },
          medication: { current_value: '', proposed_value: '' },
          treatment: { current_value: '', proposed_value: '' },
          notes: { current_value: '', proposed_value: '' },
          next_visit: { current_value: '', proposed_value: '' },
        },
        reason: ''
      });

      setSelectedRecord(null);
    
      alert('Correction request(s) submitted successfully!');

    } catch (error) {
      console.error('Submit error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit correction');
    }
  };

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/corrections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          status,
        }),
        credentials: 'include'
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update correction');
      }
      
      await fetchCorrections();
    } catch (error) {
      console.error('Decide error:', error);
      alert(error instanceof Error ? error.message : 'Failed to update correction');
    }
  };

  // Render form untuk single field mode
  const renderSingleFieldForm = () => (
    <>
      <div>
        <label className="text-xs font-medium mb-1 block">Field To Correct</label>
        <select
          title='Record ID'
          value={formData.field}
          onChange={(e) => handleFieldSelect(e.target.value)}
          className="border rounded-md px-3 py-2 w-full bg-white"
          required
          disabled={!formData.record_id}
        >
          <option value="">-- Select Field --</option>
          {availableFields.map(field => (
            <option key={field} value={field}>
              {field.replace('_', ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium mb-1 block">Current Value</label>
          <Textarea 
            value={formData.current_value} 
            disabled 
            className="bg-gray-50"
            rows={3} 
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Proposed Value</label>
          <Textarea 
            value={formData.proposed_value} 
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
              setFormData({...formData, proposed_value: e.target.value})
            } 
            required 
            rows={3} 
            placeholder="Enter new value..."
          />
        </div>
      </div>
    </>
  );

  // Render form untuk multiple fields mode
  const renderMultipleFieldsForm = () => {
    const fieldsToCorrect: Array<keyof typeof formData.fields> = [
      'diagnosis', 
      'medication', 
      'treatment', 
      'notes', 
      'next_visit'
    ];
    
    return (
      <div className="space-y-3 max-h-96 overflow-y-auto">
        <label className="text-sm font-medium">Select Fields to Correct:</label>
        {fieldsToCorrect.map(field => (
          <div key={field} className="border rounded-md p-3 space-y-2 bg-gray-50">
            <label className="flex items-center gap-2 font-medium text-sm capitalize">
              <input
                type="checkbox"
                checked={formData.fields[field].proposed_value !== ''}
                onChange={(e) => {
                  if (!e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      fields: {
                        ...prev.fields,
                        [field]: { ...prev.fields[field], proposed_value: '' }
                      }
                    }));
                  }
                }}
              />
              {field.replace('_', ' ')}
            </label>
            
            <div className="grid grid-cols-2 gap-2 ml-6">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Current Value</label>
                <Textarea 
                  value={formData.fields[field].current_value} 
                  disabled 
                  className="bg-white text-xs"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Proposed Value</label>
                <Textarea 
                  value={formData.fields[field].proposed_value}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                    setFormData(prev => ({
                      ...prev,
                      fields: {
                        ...prev.fields,
                        [field]: { 
                          ...prev.fields[field], 
                          proposed_value: e.target.value 
                        }
                      }
                    }))
                  }
                  className="text-xs"
                  rows={2}
                  placeholder={`New ${field}...`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  function getStatusStyle(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Data Corrections</h1>
          <p className="text-gray-500 mt-1">Review and manage change requests for medical records.</p>
        </div>
        {role === 'doctor' && (
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all text-white flex items-center gap-2 px-6 py-2.5 rounded-full">
            <Edit3 className="w-4 h-4" /> Request Change
          </Button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
            { label: 'Pending Review', count: corrections.filter(c=>c.status==='pending').length, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock },
            { label: 'Approved', count: corrections.filter(c=>c.status==='approved').length, color: 'text-green-600', bg: 'bg-green-50', icon: Check },
            { label: 'Rejected', count: corrections.filter(c=>c.status==='rejected').length, color: 'text-red-600', bg: 'bg-red-50', icon: X },
        ].map((stat, idx) => (
            <Card key={idx} className="p-4 flex items-center justify-between border-l-4 border-l-transparent hover:border-l-blue-500 transition-all">
                <div>
                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                </div>
            </Card>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-2 sticky top-4 z-10 shadow-sm border-gray-200">
         <div className="flex flex-col sm:flex-row items-center gap-2 p-1">
            <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by Patient Name, ID, or Record ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0 bg-transparent"
                />
            </div>
            <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
            <div className="flex items-center gap-2 w-full sm:w-auto px-2">
                <filter className="w-4 h-4 text-gray-400" />
                <select
                    title="Filter by Status"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer py-2"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
         </div>
      </Card>

      {/* Main Table */}
      <Card className="overflow-hidden border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="py-4 px-6 w-16">ID</th>
                <th className="py-4 px-6">Patient Info</th>
                <th className="py-4 px-6">Change Request</th>
                <th className="py-4 px-6">Reason & Status</th>
                <th className="py-4 px-6 w-32">Date</th>
                {role === 'admin' && <th className="py-4 px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                  {/* ID */}
                  <td className="py-4 px-6 align-top">
                    <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded" title={c.id}>
                        {c.id.substring(0,6)}
                    </span>
                  </td>

                  {/* Patient Info */}
                  <td className="py-4 px-6 align-top">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="font-medium text-sm text-gray-900">{c.patient_name || 'Unknown'}</p>
                            <div className="flex flex-col text-xs text-gray-500">
                                <span className="font-mono">P: {c.patient_id?.substring(0,8)}...</span>
                                <span>Rec: {c.record_id?.substring(0,8)}...</span>
                                <span className="text-gray-400 mt-1">Dr. {c.doctor_name}</span>
                            </div>
                        </div>
                    </div>
                  </td>

                  {/* Change Request (The Diff) */}
                  <td className="py-4 px-6 align-top w-1/3">
                    <div className="mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded bg-white">
                            Field: {c.field.replace('_',' ')}
                        </span>
                    </div>
                    
                    <div className="flex flex-col gap-2 text-sm">
                         <div className="flex items-start gap-2 text-gray-500 bg-red-50/50 p-2 rounded border border-red-100/50">
                             <div className="min-w-[4px] h-4 bg-red-300 rounded-full mt-0.5"></div>
                             <span className="line-through opacity-70 text-xs">{c.current_value || '(Empty)'}</span>
                         </div>
                         <div className="flex justify-center">
                             <ArrowRight className="w-4 h-4 text-gray-300 rotate-90 md:rotate-0" />
                         </div>
                         <div className="flex items-start gap-2 text-gray-900 bg-green-50/50 p-2 rounded border border-green-100/50 shadow-sm">
                             <div className="min-w-[4px] h-4 bg-green-500 rounded-full mt-0.5"></div>
                             <span className="font-medium">{c.proposed_value}</span>
                         </div>
                    </div>
                  </td>

                  {/* Reason & Status */}
                  <td className="py-4 px-6 align-top">
                    <div className="flex flex-col h-full justify-between gap-3">
                         <Badge className={`w-fit px-2.5 py-1 text-xs border ${getStatusStyle(c.status)}`}>
                            {c.status.toUpperCase()}
                        </Badge>
                        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded italic border border-gray-100">
                            "{c.reason}"
                        </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-4 px-6 align-top">
                    <div className="text-xs text-gray-500 flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className="text-gray-400 pl-4">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </td>

                  {/* Actions (Admin Only) */}
                  {role === 'admin' && (
                    <td className="py-4 px-6 align-top text-right">
                      {c.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                          <button onClick={() => decide(c.id,'approved')} className="p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Approve">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => decide(c.id,'rejected')} className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Reject">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {c.status !== 'pending' && (
                         <span className="text-xs text-gray-400 italic">Decided</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="p-4 bg-gray-50 rounded-full mb-3">
                     <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <p>No correction requests found matching your filter.</p>
            </div>
          )}
        </div>
      </Card>

      {/* --- Modal Form --- */}
      {showForm && role === 'doctor' && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <Card className="w-full max-w-2xl bg-white shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Request Correction</h2>
                        <p className="text-xs text-gray-500">Submit a change request for admin approval</p>
                    </div>
                </div>
                <button title="Close" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <form id="correction-form" onSubmit={submitCorrection} className="space-y-6">
                  
                  {/* Step 1: Select Record */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-800">1. Select Medical Record</label>
                    <select
                      title="Medical Record"
                      value={formData.record_id}
                      onChange={(e) => handleRecordSelect(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Choose a record --</option>
                      {medicalRecords.map(record => (
                        <option key={record.id} value={record.id}>
                          {record.patient_name} ({record.species}) — {new Date(record.visit_date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                    {formData.record_id && (
                        <div className="flex gap-4 p-3 bg-blue-50/50 rounded-lg text-xs text-blue-800 border border-blue-100">
                            <span className="font-semibold">Patient: {formData.patient_name}</span>
                            <span className="font-mono text-blue-600/70">ID: {formData.patient_id}</span>
                        </div>
                    )}
                  </div>

                  {formData.record_id && (
                    <>
                         <div className="border-t border-gray-100 my-2"></div>

                        {/* Step 2: Mode & Fields */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-800">2. What needs to change?</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, correctionMode: 'single'})}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${formData.correctionMode === 'single' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Single Field
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, correctionMode: 'multiple'})}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${formData.correctionMode === 'multiple' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Multiple Fields
                                    </button>
                                </div>
                            </div>
                            
                            {formData.correctionMode === 'single' ? renderSingleFieldForm() : renderMultipleFieldsForm()}
                        </div>

                         <div className="border-t border-gray-100 my-2"></div>

                        {/* Step 3: Reason */}
                        <div className="space-y-2">
                             <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                3. Reason for Change <span className="text-red-500">*</span>
                             </label>
                             <div className="relative">
                                <AlertCircle className="w-4 h-4 absolute top-3 left-3 text-gray-400" />
                                <Textarea 
                                    value={formData.reason} 
                                    onChange={(e) => setFormData({...formData, reason: e.target.value})} 
                                    required 
                                    rows={2} 
                                    className="pl-10"
                                    placeholder="E.g., Typo in medication dosage, Wrong diagnosis selected..." 
                                />
                             </div>
                        </div>
                    </>
                  )}
                </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  form="correction-form"
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" 
                  disabled={!formData.record_id}
                >
                  Submit Request
                </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
