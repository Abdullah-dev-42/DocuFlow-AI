const RAW_API_URL = import.meta.env.VITE_API_URL || 'https://docuflow-ai-z9mr.onrender.com';
const API_BASE_URL = RAW_API_URL.trim().replace(/\/+$/, '');



async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    return { response, data };
  }

  const text = await response.text();
  return { response, data: text };
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const { data } = await parseResponse(response);

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null ? (data.detail || data.message || 'Request failed') : data || 'Request failed';
    throw new Error(message);
  }

  return data;
}

export async function fetchSystemStatus() {
  return apiRequest('/config');
}

export async function fetchDocuments() {
  return apiRequest('/documents');
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null ? payload.detail || payload.message : payload || 'Upload failed';
    throw new Error(message);
  }

  return payload;
}

export async function getDocumentDetail(documentId) {
  return apiRequest(`/documents/${documentId}`);
}

export async function analyzeDocument(documentId) {
  return apiRequest(`/documents/${documentId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function updateActionStatus(actionId, status) {
  return apiRequest(`/actions/${actionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
}

export async function deleteDocument(documentId) {
  return apiRequest(`/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export { API_BASE_URL };
