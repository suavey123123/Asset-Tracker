import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Btn, Modal, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI';
import ImportEmployeesCSV from './ImportEmployeesCSV';

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '',
  site_id: null, hire_date: null,
};

export default function Employees({ onViewEmployee }) {
  const { isAdmin } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [assets, setAssets] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSite, setFilterSite] = useState('');

  const [viewEmp, setViewEmp] = useState(null);
  const [empHistory, setEmpHistory] = useState({ log: [], current: [] });

  const [selected, setSelected] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [offboardEmp, setOffboardEmp] = useState(null);
  const [offboarding, setOffboarding] = useState(false);

  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const [showColPicker, setShowColPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_cols');
      if (!saved) return ['name', 'email', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions'];
      const parsed = JSON.parse(saved);
      const valid = ['name','email','title','department','site','phone','hire_date','assets','actions'];
      return Array.isArray(parsed) && parsed.every(c => valid.includes(c))
        ? parsed
        : ['name','email','department','site','phone','hire_date','assets','actions'];
    } catch {
      return ['name','email','department','site','phone','hire_date','assets','actions'];
    }
  });

  const ALL_EMP_COLS = [
    { id: 'name',       label: 'Name',          fixed: true },
    { id: 'email',      label: 'Email',         fixed: false },
    { id: 'title',      label: 'Job Title',     fixed: false },
    { id: 'department', label: 'Department',    fixed: false },
    { id: 'site',       label: 'Site',          fixed: false },
    { id: 'phone',      label: 'Phone',         fixed: false },
    { id: 'hire_date',  label: 'Hire Date',     fixed: false },
    { id: 'assets',     label: 'Assets',        fixed: false },
    { id: 'actions',    label: 'Actions',       fixed: true },
  ];

  const hasCol = (id) => visibleCols.includes(id);

  const toggleEmpCol = (id) => {
    if (ALL_EMP_COLS.find(c => c.id === id)?.fixed) return;
    setVisibleCols(prev => {
      const updated = prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id];
      localStorage.setItem('emp_cols', JSON.stringify(updated));
      return updated;
    });
  };

  // Close column picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    const close = (e) => {
      if (!e.target.closest('[data-colpicker]')) setShowColPicker(false);
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', close), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', close);
    };
  }, [showColPicker]);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [{ data: e }, { data: a }, { data: s }] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('assets').select('id, name, asset_tag, category, status, assigned_to').eq('status', 'Checked Out'),
        supabase.from('sites').select('id, name').order('name'),
      ]);

      setEmployees(e || []);
      setAssets(a || []);
      setSites(s || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  function openAdd() {
    setEditEmp(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditEmp(emp);
    setForm({
      name: emp.name || '',
      email: emp.email || '',
      department: emp.department || '',
      title: emp.title || '',
      phone: emp.phone || '',
      location: emp.location || '',
      notes: emp.notes || '',
      site_id: emp.site_id || null,
      hire_date: emp.hire_date || '',
    });
    setError('');
    setModalOpen(true);
  }

  async function fetchEmpHistory(emp) {
    if (!emp) return;
    try {
      const [{ data: log }, { data: current }] = await Promise.all([
        supabase.from('activity_log')
          .select('*')
          .ilike('message', `%${emp.name}%`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('assets')
          .select('id, asset_tag, model, category, status, purchase_date')
          .eq('assigned_to', emp.name),
      ]);
      setEmpHistory({ log: log || [], current: current || [] });
    } catch (err) {
      console.error(err);
    }
  }

  // ... keep your save(), deleteEmp(), offboard(), bulkDelete(), getEmployeeAssets() functions as they are ...

  // Filtering & Sorting (unchanged - looks good)
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();

  const filtered = employees.filter(e => {
    if (filterSite && e.site_id !== filterSite) return false;
    if (filterDept && e.department !== filterDept) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${e.name} ${e.email} ${e.department} ${e.title}`.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    // ... your existing sorting logic ...
    // (keeping it as is for now)
  });

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {/* Stats, Controls, Column Picker, Table - unchanged */}

      {/* View Employee Modal */}
      <Modal 
        open={!!viewEmp} 
        onClose={() => setViewEmp(null)} 
        title={viewEmp?.name || 'Employee'} 
        width={580}
      >
        {viewEmp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Put your employee detail content here */}
            <pre>{JSON.stringify(viewEmp, null, 2)}</pre> {/* Temporary for debugging */}

            {isAdmin && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <Btn onClick={() => { setViewEmp(null); openEdit(viewEmp); }}>
                  Edit
                </Btn>
                <Btn variant="danger" onClick={() => setOffboardEmp(viewEmp)}>
                  Offboard Employee
                </Btn>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ImportEmployeesCSV open={importOpen} onClose={() => setImportOpen(false)} onDone={fetchAll} sites={sites} />

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmp ? 'Edit Employee' : 'Add Employee'}>
        {/* Your form content here */}
      </Modal>

      {/* Offboard Modal */}
      <Modal open={!!offboardEmp} onClose={() => setOffboardEmp(null)} title="Offboard Employee" width={440}>
        {/* Your offboard content */}
      </Modal>
    </div>
  );
}