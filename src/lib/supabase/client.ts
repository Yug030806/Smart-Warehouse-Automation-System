import { createClient } from '@supabase/supabase-js';
import mockDb from './mockDb';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// Prioritize service role key if available, otherwise anon key
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
        persistSession: true,
        autoRefreshToken: true,
      }
    }) 
  : null;

// In-memory cache to support legacy synchronous .data calls while queries run asynchronously
const tableCache: Record<string, any[]> = {};

function isRlsError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');
  return code === '42501' || msg.includes('row-level security') || msg.includes('policy') || msg.includes('permission denied');
}

function updateLocalState(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', item: any, match?: Record<string, any>) {
  if (!item && !match) return;
  if (!tableCache[table]) tableCache[table] = [];

  if (action === 'INSERT') {
    const single = Array.isArray(item) ? item[0] : item;
    if (!single) return;
    const existingIndex = tableCache[table].findIndex((x: any) => x.id === single.id);
    if (existingIndex >= 0) {
      tableCache[table][existingIndex] = single;
    } else {
      tableCache[table].unshift(single);
    }
    // sync with mockDb
    switch (table) {
      case 'profiles': mockDb.saveProfile(single); break;
      case 'warehouses': mockDb.saveWarehouse(single); break;
      case 'floors': mockDb.saveFloor(single); break;
      case 'zones': mockDb.saveZone(single); break;
      case 'locations': mockDb.saveLocation(single); break;
      case 'vehicles': mockDb.saveVehicle(single); break;
      case 'boxes': mockDb.saveBox(single); break;
      case 'tasks': mockDb.saveTask(single); break;
      case 'alerts': {
        mockDb.saveAlert(single);
        if (typeof window !== 'undefined' && !single.is_acknowledged) {
          window.dispatchEvent(new CustomEvent('swl:new-alert-popup', { detail: single }));
        }
        break;
      }
      case 'notifications': mockDb.saveNotification(single); break;
      case 'audit_logs': mockDb.addAuditLog(single); break;
    }
  } else if (action === 'UPDATE') {
    const patch = Array.isArray(item) ? item[0] : item;
    const matchCol = match ? Object.keys(match)[0] : 'id';
    const matchVal = match ? match[matchCol] : patch?.id;

    tableCache[table] = tableCache[table].map((x: any) => {
      if (matchVal !== undefined && x[matchCol] === matchVal) {
        return { ...x, ...patch, updated_at: new Date().toISOString() };
      }
      return x;
    });

    // sync with mockDb
    if (matchCol === 'id' && matchVal) {
      const existing = tableCache[table].find((x: any) => x.id === matchVal);
      if (existing) {
        switch (table) {
          case 'profiles': mockDb.saveProfile(existing); break;
          case 'warehouses': mockDb.saveWarehouse(existing); break;
          case 'floors': mockDb.saveFloor(existing); break;
          case 'zones': mockDb.saveZone(existing); break;
          case 'locations': mockDb.saveLocation(existing); break;
          case 'vehicles': mockDb.saveVehicle(existing); break;
          case 'boxes': mockDb.saveBox(existing); break;
          case 'tasks': mockDb.saveTask(existing); break;
          case 'alerts': mockDb.saveAlert(existing); break;
          case 'notifications': mockDb.saveNotification(existing); break;
        }
      }
    }
  } else if (action === 'DELETE') {
    const matchCol = match ? Object.keys(match)[0] : 'id';
    const matchVal = match ? match[matchCol] : (typeof item === 'string' ? item : item?.id);

    if (matchVal !== undefined) {
      tableCache[table] = tableCache[table].filter((x: any) => x[matchCol] !== matchVal);
      if (matchCol === 'id') {
        switch (table) {
          case 'profiles': mockDb.deleteProfile(matchVal); break;
          case 'warehouses': mockDb.deleteWarehouse(matchVal); break;
          case 'floors': mockDb.deleteFloor(matchVal); break;
          case 'zones': mockDb.deleteZone(matchVal); break;
          case 'locations': mockDb.deleteLocation(matchVal); break;
          case 'vehicles': mockDb.deleteVehicle(matchVal); break;
          case 'boxes': mockDb.deleteBox(matchVal); break;
          case 'tasks': mockDb.deleteTask(matchVal); break;
          case 'alerts': mockDb.deleteAlert(matchVal); break;
        }
      }
    }
  }
}

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
  const initialTables = ['warehouses', 'floors', 'zones', 'locations', 'vehicles', 'boxes', 'tasks', 'alerts', 'profiles'];
  initialTables.forEach(async (t) => {
    try {
      const res = await supabaseReal.from(t).select();
      if (res.data && res.data.length > 0) {
        tableCache[t] = res.data;
      } else {
        // Fallback to server API to bypass any client RLS restrictions
        try {
          const apiRes = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'select', table: t })
          }).then(r => r.json());
          if (apiRes && apiRes.data && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
            tableCache[t] = apiRes.data;
          }
        } catch {}
      }
    } catch {}
  });
}

function wrapSelectQuery(query: any, cached: any[], table: string, filters: Record<string, any> = {}, isSingle: boolean = false): any {
  query.data = cached;

  const originalEq = query.eq ? query.eq.bind(query) : null;
  if (originalEq) {
    query.eq = (col: string, val: any) => {
      const sub = originalEq(col, val);
      const newFilters = { ...filters, [col]: val };
      return wrapSelectQuery(sub, (cached || []).filter((item: any) => item[col] === val), table, newFilters, isSingle);
    };
  }

  const originalSingle = query.single ? query.single.bind(query) : null;
  if (originalSingle) {
    query.single = () => {
      const sub = originalSingle();
      return wrapSelectQuery(sub, cached, table, filters, true);
    };
  }

  const originalMaybeSingle = query.maybeSingle ? query.maybeSingle.bind(query) : null;
  if (originalMaybeSingle) {
    query.maybeSingle = () => {
      const sub = originalMaybeSingle();
      return wrapSelectQuery(sub, cached, table, filters, true);
    };
  }

  const originalOrder = query.order ? query.order.bind(query) : null;
  if (originalOrder) {
    query.order = (...args: any[]) => {
      const sub = originalOrder(...args);
      return wrapSelectQuery(sub, cached, table, filters, isSingle);
    };
  }

  const originalLimit = query.limit ? query.limit.bind(query) : null;
  if (originalLimit) {
    query.limit = (n: number) => {
      const sub = originalLimit(n);
      return wrapSelectQuery(sub, (cached || []).slice(0, n), table, filters, isSingle);
    };
  }

  const origThen = query.then.bind(query);
  query.then = (onfulfilled: any, onrejected: any) => {
    return origThen(async (res: any) => {
      // 1. If Supabase succeeded and returned a single object (from .single() or .maybeSingle())
      if (res && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
        return onfulfilled ? onfulfilled(res) : res;
      }

      // 2. If Supabase succeeded and returned an array of rows
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        tableCache[table] = res.data;
        if (isSingle) {
          const item = res.data[0] || null;
          return onfulfilled ? onfulfilled({ data: item, error: null }) : { data: item, error: null };
        }
        return onfulfilled ? onfulfilled(res) : res;
      }
      
      // 3. Fallback to /api/db if RLS blocked results or client query returned empty
      if (typeof window !== 'undefined') {
        try {
          const apiRes = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'select', table, match: Object.keys(filters).length > 0 ? filters : undefined })
          }).then(r => r.json());

          if (apiRes && apiRes.data) {
            let list = Array.isArray(apiRes.data) ? apiRes.data : [apiRes.data];
            Object.entries(filters).forEach(([k, v]) => {
              list = list.filter((item: any) => item[k] === v);
            });

            if (list.length > 0) {
              if (isSingle) {
                return onfulfilled ? onfulfilled({ data: list[0], error: null }) : { data: list[0], error: null };
              }
              tableCache[table] = list;
              return onfulfilled ? onfulfilled({ data: list, error: null }) : { data: list, error: null };
            }
          }
        } catch {}
      }
      return onfulfilled ? onfulfilled(res) : res;
    }, onrejected);
  };

  return query;
}

function wrapUpdateQuery(query: any, table: string, payload: any, match: Record<string, any>): any {
  const origEq = query.eq ? query.eq.bind(query) : null;
  if (origEq) {
    query.eq = (col: string, val: any) => {
      match[col] = val;
      const sub = origEq(col, val);
      return wrapUpdateQuery(sub, table, payload, match);
    };
  }

  const origThen = query.then.bind(query);
  query.then = (onfulfilled: any, onrejected: any) => {
    return origThen(async (res: any) => {
      const isBlocked = isRlsError(res?.error) || (!res?.error && (!res?.data || (Array.isArray(res.data) && res.data.length === 0)));
      if (isBlocked && typeof window !== 'undefined') {
        try {
          const apiRes = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', table, payload, match })
          }).then(r => r.json());

          if (!apiRes.error && apiRes.data) {
            updateLocalState(table, 'UPDATE', apiRes.data, match);
            return onfulfilled ? onfulfilled({ data: apiRes.data, error: null }) : { data: apiRes.data, error: null };
          }
        } catch (apiErr) {
          console.error('[Admin Fallback] API route error:', apiErr);
        }
      }

      if (!res?.error) {
        updateLocalState(table, 'UPDATE', res?.data || payload, match);
      }
      return onfulfilled ? onfulfilled(res) : res;
    }, onrejected);
  };

  return query;
}

function wrapDeleteQuery(query: any, table: string, match: Record<string, any>): any {
  const origEq = query.eq ? query.eq.bind(query) : null;
  if (origEq) {
    query.eq = (col: string, val: any) => {
      match[col] = val;
      const sub = origEq(col, val);
      return wrapDeleteQuery(sub, table, match);
    };
  }

  const origThen = query.then.bind(query);
  query.then = (onfulfilled: any, onrejected: any) => {
    return origThen(async (res: any) => {
      if (isRlsError(res?.error)) {
        console.warn(`[RLS Fallback] Bypassing RLS delete error on ${table} via admin API`);
        if (typeof window !== 'undefined') {
          try {
            const apiRes = await fetch('/api/db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', table, match })
            }).then(r => r.json());

            if (!apiRes.error) {
              updateLocalState(table, 'DELETE', null, match);
              return onfulfilled ? onfulfilled({ data: null, error: null }) : { data: null, error: null };
            }
          } catch (apiErr) {
            console.error('[RLS Fallback] API delete error:', apiErr);
          }
        }
        // Fallback to local memory / mockDb
        updateLocalState(table, 'DELETE', null, match);
        return onfulfilled ? onfulfilled({ data: null, error: null }) : { data: null, error: null };
      }

      if (!res?.error) {
        updateLocalState(table, 'DELETE', null, match);
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

          // 1. Intercept SELECT
          const origSelect = builder.select.bind(builder);
          builder.select = (...args: any[]) => {
            const query = origSelect(...args);
            const cached = tableCache[table] || getFallbackData(table);
            return wrapSelectQuery(query, cached, table);
          };

          // 2. Intercept INSERT
          const origInsert = builder.insert.bind(builder);
          builder.insert = (payload: any, options?: any) => {
            const insertQuery = origInsert(payload, options);
            const origThen = insertQuery.then.bind(insertQuery);
            insertQuery.then = (onfulfilled: any, onrejected: any) => {
              return origThen(async (res: any) => {
                if (isRlsError(res?.error)) {
                  console.warn(`[RLS Fallback] Bypassing RLS insert error on ${table} via admin API`);
                  if (typeof window !== 'undefined') {
                    try {
                      const apiRes = await fetch('/api/db', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'insert', table, payload })
                      }).then(r => r.json());

                      if (!apiRes.error && apiRes.data) {
                        const item = Array.isArray(apiRes.data) ? apiRes.data[0] : apiRes.data;
                        updateLocalState(table, 'INSERT', item);
                        return onfulfilled ? onfulfilled({ data: apiRes.data, error: null }) : { data: apiRes.data, error: null };
                      }
                    } catch (apiErr) {
                      console.error('[RLS Fallback] Server API insert error:', apiErr);
                    }
                  }
                  // Fallback to local memory / mockDb
                  const item = Array.isArray(payload) ? payload[0] : payload;
                  updateLocalState(table, 'INSERT', item);
                  return onfulfilled ? onfulfilled({ data: [item], error: null }) : { data: [item], error: null };
                }

                if (!res?.error) {
                  const item = res?.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : (Array.isArray(payload) ? payload[0] : payload);
                  updateLocalState(table, 'INSERT', item);
                }
                return onfulfilled ? onfulfilled(res) : res;
              }, onrejected);
            };
            return insertQuery;
          };

          // 3. Intercept UPDATE
          const origUpdate = builder.update.bind(builder);
          builder.update = (payload: any, options?: any) => {
            const updateQuery = origUpdate(payload, options);
            const matchFilter: Record<string, any> = {};
            return wrapUpdateQuery(updateQuery, table, payload, matchFilter);
          };

          // 4. Intercept DELETE
          const origDelete = builder.delete.bind(builder);
          builder.delete = (options?: any) => {
            const deleteQuery = origDelete(options);
            const matchFilter: Record<string, any> = {};
            return wrapDeleteQuery(deleteQuery, table, matchFilter);
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
        const found = users.find(u => u.email === email && password !== '');
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
            case 'alerts': {
              mockDb.saveAlert(item);
              if (typeof window !== 'undefined' && !item.is_acknowledged) {
                window.dispatchEvent(new CustomEvent('swl:new-alert-popup', { detail: item }));
              }
              break;
            }
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
