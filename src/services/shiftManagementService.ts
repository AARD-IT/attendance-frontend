const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function authHeader() {
  const token = localStorage.getItem('attendance-dashboard-token') || ''
  return { Authorization: `Bearer ${token}` }
}

function fallbackAssignments() {
  try {
    return JSON.parse(localStorage.getItem('shift-management-assignments') || '[]')
  } catch {
    return []
  }
}

export async function getShiftAssignments() {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments`, { headers: { ...authHeader() } })
    if (!res.ok) throw new Error('Failed to fetch shift assignments')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return fallbackAssignments()
  }
}

export async function createShiftAssignment(payload: any) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('Failed to create shift assignment')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.employee_id) !== String(payload.employee_id))
    saved.push(payload)
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return payload
  }
}

export async function updateShiftAssignment(id: string, payload: any) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('Failed to update shift assignment')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.id) !== String(id))
    saved.push({ ...payload, id })
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return { ...payload, id }
  }
}

export async function deleteShiftAssignment(id: string) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/${id}`, { method: 'DELETE', headers: { ...authHeader() } })
    if (!res.ok) throw new Error('Failed to delete shift assignment')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.id) !== String(id))
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return { deleted: true }
  }
}

export async function deleteEmployeeShiftAssignments(employeeId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/ceo/shift-assignments/employee/${employeeId}`, { method: 'DELETE', headers: { ...authHeader() } })
    if (!res.ok) throw new Error('Failed to delete employee shift assignments')
    return await res.json()
  } catch {
    const saved = fallbackAssignments().filter((item: any) => String(item.employee_id) !== String(employeeId))
    localStorage.setItem('shift-management-assignments', JSON.stringify(saved))
    return { deleted: true }
  }
}

export default { getShiftAssignments, createShiftAssignment, updateShiftAssignment, deleteShiftAssignment, deleteEmployeeShiftAssignments }
