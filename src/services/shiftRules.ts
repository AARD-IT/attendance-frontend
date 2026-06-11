export const SHIFT_RULES = [
  { id: 'Shift 1', label: 'Shift 1', loginCutoff: '10:35 AM', logoutCutoff: '06:00 PM' },
  { id: 'Shift 2', label: 'Shift 2', loginCutoff: '02:35 PM', logoutCutoff: '10:00 PM' },
] as const

export const DEFAULT_SHIFT_ASSIGNMENTS = [
  {
    id: 'demo-1',
    employee_id: 'EMP-1001',
    minerva_employee_id: 'M-1001',
    employee_name: 'Rafiq',
    employee_email: 'rafiq@company.com',
    cc_email: 'manager@company.com',
    shift_type: 'Shift 2',
    effective_from: '2026-06-01',
    effective_to: '2026-06-30',
    is_active: true,
  },
]
