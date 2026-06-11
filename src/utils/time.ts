export function formatPunchTime(value?: string | null): string {
  if (!value) return '—'

  const text = String(value).trim().replace('Z', '+00:00')
  const match = text.match(/\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/) 

  if (match) {
    return match[0].slice(0, 5)
  }

  return '—'
}

export function formatAttendanceDate(value?: string | null): string {
  if (!value) return '—'

  const text = String(value).trim()
  return text.length >= 10 ? text.slice(0, 10) : text
}

export function averageTimeLabel(values: Array<string | null | undefined>): string {
  const valid = values
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item) && item !== '--')
    .map((item) => {
      const [hours, minutes] = item.split(':').map(Number)
      return hours * 60 + minutes
    })

  if (!valid.length) return '--'

  const meanX = valid.reduce((sum, minute) => sum + Math.cos((2 * Math.PI * minute) / 1440), 0) / valid.length
  const meanY = valid.reduce((sum, minute) => sum + Math.sin((2 * Math.PI * minute) / 1440), 0) / valid.length

  if (meanX === 0 && meanY === 0) {
    const avgMinutes = Math.round(valid.reduce((sum, minute) => sum + minute, 0) / valid.length)
    return `${String(Math.floor(avgMinutes / 60)).padStart(2, '0')}:${String(avgMinutes % 60).padStart(2, '0')}`
  }

  const angle = Math.atan2(meanY, meanX)
  const avgMinutes = Math.round(((angle / (2 * Math.PI)) * 1440 + 1440) % 1440)

  return `${String(Math.floor(avgMinutes / 60)).padStart(2, '0')}:${String(avgMinutes % 60).padStart(2, '0')}`
}

export function formatDepartmentName(value: unknown): string {
  if (value == null) return 'Unknown'

  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return 'Unknown'

    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'))
      if (parsed && typeof parsed === 'object') {
        return String((parsed as { dept_name?: string; department_name?: string; name?: string }).dept_name || (parsed as { department_name?: string }).department_name || (parsed as { name?: string }).name || 'Unknown')
      }
    } catch {
      // Fall back to regex extraction below.
    }

    const deptMatch = text.match(/dept_name\s*[:=]\s*['"]?([^'",}]+)['"]?/i)
    const departmentMatch = text.match(/department_name\s*[:=]\s*['"]?([^'",}]+)['"]?/i)

    return deptMatch?.[1] || departmentMatch?.[1] || text
  }

  if (typeof value === 'object') {
    const candidate = value as { dept_name?: string; department_name?: string; name?: string }
    return candidate.dept_name || candidate.department_name || candidate.name || 'Unknown'
  }

  return String(value)
}
