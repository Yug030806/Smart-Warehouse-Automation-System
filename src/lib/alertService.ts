import { supabase } from '@/lib/supabase/client';
import { mockDb } from '@/lib/supabase/mockDb';
import { Alert } from '@/lib/database.types';
import { generateUUID } from '@/lib/uuid';

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
    id: generateUUID(),
    type: input.type,
    severity: input.severity,
    message: input.message,
    vehicle_id: input.vehicle_id,
    task_id: input.task_id,
    is_acknowledged: false,
    resolved_at: null,
    created_at: new Date().toISOString(),
  };

  // Insert into Supabase
  try {
    supabase.from('alerts').insert(newAlert);
  } catch (err) {
    console.error('Failed to insert alert to Supabase DB:', err);
  }

  // Also save to mockDb for instant local cache availability
  try {
    mockDb.saveAlert(newAlert);
  } catch (err) {
    console.error('Failed to save alert to mockDb:', err);
  }

  // Dispatch custom window event for real-time pop-up notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('swl:new-alert-popup', { detail: newAlert }));
  }

  return newAlert;
}

/**
 * Helper to display any error as a pop-up alert across any section of the website.
 */
export function showAppError(message: string, severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'CRITICAL', type: Alert['type'] = 'SYSTEM_ERROR') {
  return triggerGlobalAlert({
    type,
    severity,
    message
  });
}
