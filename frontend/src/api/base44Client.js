import { appParams } from '@/lib/app-params';

const baseUrl = `${appParams.serverUrl}/api`;
const TOKEN_STORAGE_KEY = 'base44_access_token';

const getToken = () => {
  if (appParams.token) return appParams.token;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      appParams.token = stored;
      return stored;
    }
  }
  return null;
};

const setToken = (token) => {
  appParams.token = token || null;
  if (typeof window !== 'undefined') {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
};

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload && payload.error ? payload.error : (response.statusText || 'Request failed');
    const error = new Error(message);
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
};

const makeEntityClient = (entityName) => ({
  list: (sort = '') => request(`/entities/${entityName}${sort ? `?sort=${encodeURIComponent(sort)}` : ''}`),
  filter: (where = {}) => {
    const params = new URLSearchParams(where);
    return request(`/entities/${entityName}/filter?${params.toString()}`);
  },
  create: (data) => request(`/entities/${entityName}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/entities/${entityName}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => request(`/entities/${entityName}/${id}`, { method: 'DELETE' }),
});

const entitiesProxy = new Proxy(
  {},
  {
    get: (_, entityName) => makeEntityClient(String(entityName)),
  }
);

const noopIntegration = async () => ({ ok: true });

export const base44 = {
  entities: entitiesProxy,
  auth: {
    login: async (email, password) => {
      const payload = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (payload && payload.access_token) {
        setToken(payload.access_token);
      }
      return payload;
    },
    me: () => request('/auth/me'),
    logout: () => {
      setToken(null);
    },
    redirectToLogin: () => {
      // Handled by app auth state.
    },
  },
  appLogs: {
    logUserInApp: async (pageName) => {
      return request('/app-logs/log-user-in-app', {
        method: 'POST',
        body: JSON.stringify({ pageName }),
      });
    },
  },
  integrations: {
    Core: {
      InvokeLLM: noopIntegration,
      SendEmail: noopIntegration,
      SendSMS: noopIntegration,
      UploadFile: noopIntegration,
      GenerateImage: noopIntegration,
      ExtractDataFromUploadedFile: noopIntegration,
    },
  },
};
