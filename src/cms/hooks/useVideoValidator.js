import { useState, useCallback } from 'react';

/**
 * Читает видеометаданные через HTML5 Video API.
 * Возвращает { width, height, duration, codec? }
 */
function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.addEventListener('loadedmetadata', () => {
      const result = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        aspectRatio: video.videoWidth / video.videoHeight,
      };
      URL.revokeObjectURL(url);
      resolve(result);
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать метаданные видео'));
    });

    video.src = url;
  });
}

const MAX_FILE_SIZE_MB = 2048;
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
const ASPECT_TOLERANCE = 0.05;

/**
 * Хук строгой frontend-валидации загружаемого видео
 * относительно аппаратных требований выбранного экрана.
 *
 * @returns {{ validate, validationResult, isValidating }}
 */
export function useVideoValidator() {
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(async (file, targetScreen) => {
    setIsValidating(true);
    setValidationResult(null);

    const errors = [];
    const warnings = [];

    // 1. Тип файла
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.webm')) {
      errors.push(`Неподдерживаемый формат: ${file.type || 'неизвестный'}. Допустимы: MP4, WebM, MOV, MKV`);
    }

    // 2. Размер файла
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      errors.push(`Размер файла ${sizeMb.toFixed(0)} MB превышает лимит ${MAX_FILE_SIZE_MB} MB`);
    }

    // 3. Чтение метаданных через Video API
    let meta = null;
    try {
      meta = await probeVideo(file);
    } catch {
      errors.push('Не удалось прочитать метаданные видеофайла. Возможно, файл повреждён.');
    }

    if (meta && targetScreen) {
      const tW = targetScreen.resolutionWidth;
      const tH = targetScreen.resolutionHeight;
      const targetAspect = tW / tH;

      // 4. Соотношение сторон
      const aspectDiff = Math.abs(meta.aspectRatio - targetAspect);
      if (aspectDiff > ASPECT_TOLERANCE) {
        const metaLabel = `${meta.width}×${meta.height} (${meta.aspectRatio.toFixed(2)})`;
        const targetLabel = `${tW}×${tH} (${targetAspect.toFixed(2)})`;
        errors.push(
          `Соотношение сторон ролика ${metaLabel} не совпадает с дисплеем ${targetLabel}. ` +
          (meta.aspectRatio > 1 && targetAspect < 1
            ? 'Вы загружаете горизонтальный ролик для вертикального экрана.'
            : meta.aspectRatio < 1 && targetAspect > 1
              ? 'Вы загружаете вертикальный ролик для горизонтального экрана.'
              : 'Подготовьте ролик с правильным соотношением сторон.'),
        );
      }

      // 5. Разрешение
      if (meta.width < tW || meta.height < tH) {
        warnings.push(
          `Разрешение ролика (${meta.width}×${meta.height}) ниже разрешения экрана (${tW}×${tH}). ` +
          'Качество изображения может пострадать.',
        );
      }

      if (meta.width > tW * 2 || meta.height > tH * 2) {
        warnings.push(
          `Разрешение ролика (${meta.width}×${meta.height}) значительно выше экрана (${tW}×${tH}). ` +
          'Рекомендуется оптимизировать для экономии трафика.',
        );
      }
    }

    const result = {
      file,
      meta,
      errors,
      warnings,
      isValid: errors.length === 0,
    };

    setValidationResult(result);
    setIsValidating(false);
    return result;
  }, []);

  const reset = useCallback(() => {
    setValidationResult(null);
    setIsValidating(false);
  }, []);

  return { validate, validationResult, isValidating, reset };
}
