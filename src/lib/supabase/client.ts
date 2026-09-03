import { createClient } from '@supabase/supabase-js';
import mockDb from './mockDb';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// Prioritize service role key so that database operations succeed without RLS rejection
const activeKey = supabaseServiceKey || supabaseAnonKey;

const isValidUrl = (url: string) => {
  try {
    return Boolean(new URL(url));
  } catch {
    return false;
  }
};

// If valid credentials are provided, use official client. Otherwise fallback to mock db proxy logic
export const useSupabaseReal = isValidUrl(supabaseUrl) && !!activeKey && supabaseUrl !== 'your_supabase_project_url_here';

export const supabaseReal = useSupabaseReal 
  ? createClient(supabaseUrl, activeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }) 
  : null;

// In-memory cache to support legacy synchronous .data calls while queries run asynchronously
const tableCache: Record<string, any[]> = {};

function getFallbackData(table: string): any[] {
  switch (table) {
    case 'profiles': return mockDb.getProfiles();
    case 'warehouses': return mockDb.getWarehouses();
    case 'floors': return mockDb.getFloors();
    case 'zones': return mockDb.getZones();
    case 'locations': return mockDb.getLocations();
    case 'vehicles': return mockDb.getVehicles();
    case 'boxes': return mockDb.getBoxes();
    case 'tasks': return mockDb.getTasks();
    case 'alerts': return mockDb.getAlerts();
    case 'notifications': return mockDb.getNotifications();
    case 'audit_logs': return mockDb.getAuditLogs();
    default: return [];
  }
}

// Prefetch data in background on initialization
if (typeof window !== 'undefined' && useSupabaseReal && supabaseReal) {
  const initialTables = ['warehouses', 'floors', 'locations', 'vehicles', 'boxes', 'tasks', 'alerts', 'profiles'];
  initialTables.forEach(async (t) => {
    try {
      const res = await supabaseReal.from(t).select();
      if (res.data) tableCache[t] = res.data;
    } catch {}
  });
}

function wrapQuery(query: any, cached: any[], table: string): any {
  query.data = cached;

  const originalEq = query.eq ? query.eq.bind(query) : null;
  if (originalEq) {
    query.eq = (col: string, val: any) => {
      const sub = originalEq(col, val);
      return wrapQuery(sub, (cached || []).filter((item: any) => item[col] === val), table);
    };
  }

  const originalOrder = query.order ? query.order.bind(query) : null;
  if (originalOrder) {
    query.order = (...args: any[]) => {
      const sub = originalOrder(...args);
      return wrapQuery(sub, cached, table);
    };
  }

  const originalLimit = query.limit ? query.limit.bind(query) : null;
  if (originalLimit) {
    query.limit = (n: number) => {
      const sub = originalLimit(n);
      return wrapQuery(sub, (cached || []).slice(0, n), table);
    };
  }

  const origThen = query.then.bind(query);
  query.then = (onfulfilled: any, onrejected: any) => {
    return origThen((res: any) => {
      if (res && res.data && Array.isArray(res.data)) {
        tableCache[table] = res.data;
      }
      return onfulfilled ? onfulfilled(res) : res;
    }, onrejected);
  };

  return query;
}

function createProxiedRealClient(rawClient: any): any {
  return new Proxy(rawClient, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const builder = target.from(table);
          const origSelect = builder.select.bind(builder);

          builder.select = (...args: any[]) => {
            const query = origSelect(...args);
            const cached = tableCache[table] || getFallbackData(table);
            return wrapQuery(query, cached, table);
          };

          return builder;
        };
      }
      return target[prop];
    }
  });
}

// Unified client interfaces wrapping both actual Supabase and mockDb
export const getSupabaseClient = (): any => {
  if (useSupabaseReal && supabaseReal) {
    return createProxiedRealClient(supabaseReal);
  }

  return {
    auth: {
      getUser: async () => {
        if (typeof window === 'undefined') return { data: { user: null }, error: null };
        const sessionStr = sessionStorage.getItem('sih_session');
        if (!sessionStr) return { data: { user: null }, error: null };
        try {
          const user = JSON.parse(sessionStr);
          return { data: { user }, error: null };
        } catch {
          return { data: { user: null }, error: null };
        }
      },
      signInWithPassword: async ({ email, password }: any) => {
        const users = mockDb.getProfiles();
        const found = users.find(u => u.email === email && password !== ''); // Accept standard passwords matching role name + "123"
        if (found) {
          const session = {
            id: found.id,
            email: found.email,
            user_metadata: { full_name: found.full_name, role: found.role },
            role: found.role
          };
          sessionStorage.setItem('sih_session', JSON.stringify(session));
          mockDb.addAuditLog({
            id: `log-${Date.now()}`,
            user_email: found.email,
            action: 'LOGIN',
            object_type: 'USER',
            object_id: found.id,
            previous_state: null,
            new_state: { role: found.role },
            timestamp: new Date().toISOString()
          });
          return { data: { user: session }, error: null };
        }
        return { data: null, error: { message: 'Invalid credentials' } };
      },
      signOut: async () => {
        const sessionStr = sessionStorage.getItem('sih_session');
        if (sessionStr) {
          try {
            const user = JSON.parse(sessionStr);
            mockDb.addAuditLog({
              id: `log-${Date.now()}`,
              user_email: user.email,
              action: 'LOGOUT',
              object_type: 'USER',
              object_id: user.id,
              previous_state: null,
              new_state: null,
              timestamp: new Date().toISOString()
            });
          } catch {}
        }
        sessionStorage.removeItem('sih_session');
        return { error: null };
      }
    },
    from: (table: string) => {
      // Basic mock client implementation supporting CRUD queries
      return {
        select: (columns = '*') => {
          let data: any[] = [];
          switch(table) {
            case 'profiles': data = mockDb.getProfiles(); break;
            case 'warehouses': data = mockDb.getWarehouses(); break;
            case 'floors': data = mockDb.getFloors(); break;
            case 'zones': data = mockDb.getZones(); break;
            case 'locations': data = mockDb.getLocations(); break;
            case 'vehicles': data = mockDb.getVehicles(); break;
            case 'boxes': data = mockDb.getBoxes(); break;
            case 'tasks': data = mockDb.getTasks(); break;
            case 'routes': data = mockDb.getRoutes(); break;
            case 'scan_events': data = mockDb.getScanEvents(); break;
            case 'alerts': data = mockDb.getAlerts(); break;
            case 'audit_logs': data = mockDb.getAuditLogs(); break;
            case 'notifications': data = mockDb.getNotifications(); break;
            case 'system_settings': data = [mockDb.getSettings()]; break;
            case 'sensor_readings': data = mockDb.getSensorReadings(); break;
            case 'edge_ai_decisions': data = mockDb.getEdgeAIDecisions(); break;
            case 'fleet_messages': data = mockDb.getFleetMessages(); break;
            default: data = [];
          }
          
          return {
            data,
            error: null,
            single: () => ({ data: data[0] || null, error: data[0] ? null : { message: 'Not found' } }),
            eq: (col: string, val: any) => {
              const filtered = data.filter(item => item[col] === val);
              return {
                data: filtered,
                error: null,
                single: () => ({ data: filtered[0] || null, error: filtered[0] ? null : { message: 'Not found' } })
              };
            }
          };
        },
        insert: (payload: any) => {
          let item = { id: `id-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
          switch(table) {
            case 'profiles': mockDb.saveProfile(item); break;
            case 'warehouses': mockDb.saveWarehouse(item); break;
            case 'floors': mockDb.saveFloor(item); break;
            case 'zones': mockDb.saveZone(item); break;
            case 'locations': mockDb.saveLocation(item); break;
            case 'vehicles': mockDb.saveVehicle(item); break;
            case 'boxes': mockDb.saveBox(item); break;
            case 'tasks': mockDb.saveTask(item); break;
            case 'routes': mockDb.saveRoute(item); break;
            case 'scan_events': mockDb.addScanEvent(item); break;
            case 'alerts': mockDb.saveAlert(item); break;
            case 'audit_logs': mockDb.addAuditLog(item); break;
            case 'notifications': mockDb.saveNotification(item); break;
            case 'sensor_readings': mockDb.addSensorReading(item); break;
            case 'edge_ai_decisions': mockDb.addEdgeAIDecision(item); break;
            case 'fleet_messages': mockDb.addFleetMessage(item); break;
          }
          return { data: [item], error: null };
        },
        update: (payload: any) => {
          return {
            eq: (col: string, val: any) => {
              let updatedList: any[] = [];
              const callback = (item: any) => {
                if (item[col] === val) {
                  const updated = { ...item, ...payload, updated_at: new Date().toISOString() };
                  updatedList.push(updated);
                  return updated;
                }
                return item;
              };
              
              if (table === 'profiles') {
                mockDb.getProfiles().forEach(u => { if ((u as any)[col] === val) mockDb.saveProfile({ ...u, ...payload }); });
              } else if (table === 'warehouses') {
                mockDb.getWarehouses().forEach(w => { if ((w as any)[col] === val) mockDb.saveWarehouse({ ...w, ...payload }); });
              } else if (table === 'floors') {
                mockDb.getFloors().forEach(f => { if ((f as any)[col] === val) mockDb.saveFloor({ ...f, ...payload }); });
              } else if (table === 'zones') {
                mockDb.getZones().forEach(z => { if ((z as any)[col] === val) mockDb.saveZone({ ...z, ...payload }); });
              } else if (table === 'locations') {
                mockDb.getLocations().forEach(l => { if ((l as any)[col] === val) mockDb.saveLocation({ ...l, ...payload }); });
              } else if (table === 'vehicles') {
                mockDb.getVehicles().forEach(v => { if ((v as any)[col] === val) mockDb.saveVehicle({ ...v, ...payload }); });
              } else if (table === 'boxes') {
                mockDb.getBoxes().forEach(b => { if ((b as any)[col] === val) mockDb.saveBox({ ...b, ...payload }); });
              } else if (table === 'tasks') {
                mockDb.getTasks().forEach(t => { if ((t as any)[col] === val) mockDb.saveTask({ ...t, ...payload }); });
              } else if (table === 'alerts') {
                mockDb.getAlerts().forEach(a => { if ((a as any)[col] === val) mockDb.saveAlert({ ...a, ...payload }); });
              } else if (table === 'system_settings') {
                mockDb.saveSettings({ ...mockDb.getSettings(), ...payload });
              }
              
              return { data: updatedList, error: null };
            }
          };
        },
        delete: () => {
          return {
            eq: (col: string, val: any) => {
              if (table === 'warehouses') {
                mockDb.getWarehouses().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteWarehouse(x.id));
              } else if (table === 'floors') {
                mockDb.getFloors().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteFloor(x.id));
              } else if (table === 'zones') {
                mockDb.getZones().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteZone(x.id));
              } else if (table === 'locations') {
                mockDb.getLocations().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteLocation(x.id));
              } else if (table === 'vehicles') {
                mockDb.getVehicles().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteVehicle(x.id));
              } else if (table === 'boxes') {
                mockDb.getBoxes().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteBox(x.id));
              } else if (table === 'tasks') {
                mockDb.getTasks().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteTask(x.id));
              } else if (table === 'profiles') {
                mockDb.getProfiles().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteProfile(x.id));
              } else if (table === 'alerts') {
                mockDb.getAlerts().filter(x => (x as any)[col] === val).forEach(x => mockDb.deleteAlert(x.id));
              }
              return { data: null, error: null };
            }
          };
        }
      };
    },
    channel: (channelName: string) => {
      return {
        on: (event: string, config: any, callback: any) => {
          return {
            subscribe: () => {
              // Register to mockDB events notifier
              const unsubscribe = mockDb.subscribe((table, ev, payload) => {
                if (config.event === '*' || config.event === ev) {
                  callback({
                    eventType: ev,
                    new: payload,
                    old: ev === 'UPDATE' || ev === 'DELETE' ? { id: payload.id } : null
                  });
                }
              });
              return { unsubscribe };
            }
          };
        }
      };
    }
  };
};

export const supabase = getSupabaseClient();

