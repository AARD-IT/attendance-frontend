import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://xakogrhvnblqkscztuyt.supabase.co').replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Bcv_56UrWbC77pILFeN8Nw_SxgOsTSW'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

export function subscribeToAttendanceDaily(onChange: () => void) {
  const channel = supabase
    .channel('attendance-daily-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_daily' }, () => onChange())
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
