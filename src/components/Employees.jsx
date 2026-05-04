import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'
import ImportEmployeesCSV from './ImportEmployeesCSV'

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '', site_id: null, hire_date: null,
}

export default function Employees() {
  const { isAdmin } = useAuth()

  const [employees, setEmployees] = useState([])
  const [assets, setAssets] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [selected, setSelected] = useState([])

  const [viewEmp, setViewEmp] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  // Visible columns with safe default
  const [visibleCols, setVisibleCols] = useState(['name','email','department','site','phone','hire_date','assets','actions'])

  const ALL_EMP_COLS = [
    { id: 'name',       label: 'Name',       fixed: true },
    { id: 'email',      label: 'Email',      fixed: false },
    { id: 'title',      label: 'Job Title',  fixed: false },
    { id: 'department', label: 'Department', fixed: false },
    { id: 'site',       label: 'Site',       fixed: false },
    { id: 'phone',      label: 'Phone',      fixed: false },
    { id: 'hire