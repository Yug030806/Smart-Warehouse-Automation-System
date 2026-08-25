import { supabase } from '@/lib/supabase/client';
import { Alert } from '@/lib/database.types';

export interface CreateAlertInput {
  type: Alert['type'];
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  vehicle_id?: string;
  task_id?: string;
}

/**
 * Triggers a new global alert: saves to database/mockDb and dispatches a custom event for instant pop-up.
 */
export function triggerGlobalAlert(input: CreateAlertInput): Alert {
  const newAlert: Alert = {
    id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: input.type,
    severity: input.severity,
    message: input.message,
    vehicle_id: input.vehicle_id,
    task_id: input.task_id,
    is_acknowledged: false,
    resolved_at: null,
    created_at: new Date().toISOString(),
  };

  // Insert into Supabase / MockDB
  try {
    supabase.from('alerts').insert(newAlert);
  } catch (err) {
    console.error('Failed to insert alert to DB:', err);
  }

  // Dispatch custom window event for real-time pop-up notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('swl:new-alert-popup', { detail: newAlert }));
  }

  return newAlert;
}
