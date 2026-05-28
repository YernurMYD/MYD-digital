const API_BASE = '/api/v1';

/**
 * Загружает медиафайл на сервер.
 * Возвращает объект MediaFile (id, storagePath, transcodeStatus...).
 */
export async function uploadMediaFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/media/upload`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.send(formData);
  });
}

/**
 * Создаёт рекламную кампанию.
 */
export async function createCampaign(payload) {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Загружает список кампаний с поддержкой серверной пагинации и фильтрации.
 *
 * @param {{ page?: number, limit?: number, search?: string, status?: string, priority?: string, startDate?: string, endDate?: string, deviceIds?: string[] }} params
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, limit: number, totalPages: number } }>}
 */
export async function fetchCampaigns(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.deviceIds?.length) {
    params.deviceIds.forEach((id) => query.append('deviceIds', id));
  }

  const res = await fetch(`${API_BASE}/campaigns?${query.toString()}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Дублирует кампанию (POST /campaigns/:id/duplicate).
 */
export async function duplicateCampaign(campaignId) {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/duplicate`, {
    method: 'POST',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Обновляет статус кампании (PUT /campaigns/:id).
 */
export async function updateCampaignStatus(campaignId, status) {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}
