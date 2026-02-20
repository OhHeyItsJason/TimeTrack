import { appParams } from '@/lib/app-params';

const baseUrl = `${appParams.serverUrl}/api`;

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (appParams.token) {
    headers.Authorization = `Bearer ${appParams.token}`;
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
    me: () => request('/auth/me'),
    logout: () => {
      localStorage.removeItem('base44_access_token');
    },
    redirectToLogin: () => {
      // Local mode does not require auth.
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
