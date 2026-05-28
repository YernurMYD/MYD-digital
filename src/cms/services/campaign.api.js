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
 * Отправляет payload создания кампании.
 *
 * @param {{
 *   name: string,
 *   description?: string,
 *   priority: string,
 *   contentCategory: string,
 *   startAt: string,
 *   endAt: string,
 *   dailyStartTime: string,
 *   dailyEndTime: string,
 *   daysOfWeek: number[],
 *   targetDeviceIds: string[],
 *   items: Array<{ mediaFileId: string, sortOrder: number }>,
 *   videoMeta: { width: number, height: number, duration: number, codec: string },
 * }} payload
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
