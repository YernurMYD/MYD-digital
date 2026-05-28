import { useState, useMemo } from 'react';

const LOCATIONS = [
  'Алматы, пр. Абая 52',
  'Алматы, пр. Аль-Фараби 77',
  'Астана, пр. Мангилик Ел 12',
  'Астана, ул. Кенесары 40',
  'Шымкент, пр. Тауке хана 8',
  'Караганда, бул. Мира 15',
  'Атырау, пр. Сатпаева 22',
  'Актобе, пр. Абулхаир хана 3',
  'Тараз, ул. Толе би 66',
  'Павлодар, ул. 1 Мая 9',
  'Костанай, ул. Байтурсынова 70',
  'Семей, пр. Шакарима 28',
];

const SERIALS = [
  'BST-4K-001', 'BST-4K-002', 'BST-8K-003', 'BST-FHD-004',
  'BST-4K-005', 'BST-FHD-006', 'BST-8K-007', 'BST-4K-008',
  'BST-FHD-009', 'BST-4K-010', 'BST-FHD-011', 'BST-4K-012',
];

function randBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function generateDevice(i) {
  const statusRoll = Math.random();
  let status, cpuTemp, storageHealth, cpuUsage;

  if (statusRoll < 0.6) {
    status = 'online';
    cpuTemp = randBetween(38, 65);
    storageHealth = randBetween(60, 99);
    cpuUsage = randBetween(10, 55);
  } else if (statusRoll < 0.8) {
    status = 'warning';
    cpuTemp = randBetween(70, 82);
    storageHealth = randBetween(20, 40);
    cpuUsage = randBetween(60, 85);
  } else if (statusRoll < 0.92) {
    status = 'error';
    cpuTemp = randBetween(85, 98);
    storageHealth = randBetween(5, 20);
    cpuUsage = randBetween(90, 100);
  } else {
    status = 'offline';
    cpuTemp = 0;
    storageHealth = randBetween(50, 90);
    cpuUsage = 0;
  }

  const ramTotal = [2048, 4096, 8192][i % 3];

  return {
    id: `dev-${String(i).padStart(3, '0')}`,
    name: `Экран ${LOCATIONS[i % LOCATIONS.length]}`,
    serial: SERIALS[i % SERIALS.length],
    location: LOCATIONS[i % LOCATIONS.length],
    status,
    resolution: ['1920×1080', '3840×2160', '7680×4320'][i % 3],
    metrics: {
      cpuUsage,
      cpuTemp,
      ramUsed: randBetween(512, ramTotal - 256),
      ramTotal,
      storageHealth,
      uptimeHours: status === 'offline' ? 0 : randBetween(1, 2000),
      packetLoss: status === 'online' ? randBetween(0, 2) : randBetween(5, 30),
    },
    lastSeen: status === 'offline'
      ? new Date(Date.now() - randBetween(6, 120) * 60_000)
      : new Date(Date.now() - randBetween(5, 60) * 1_000),
    alerts: status === 'error' ? randBetween(1, 5) : status === 'warning' ? randBetween(1, 2) : 0,
  };
}

const MOCK_DEVICES = Array.from({ length: 12 }, (_, i) => generateDevice(i));

export function useMockDevices() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const devices = useMemo(() => {
    let list = MOCK_DEVICES;
    if (filter !== 'all') {
      list = list.filter((d) => d.status === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.serial.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search]);

  const counts = useMemo(() => ({
    all: MOCK_DEVICES.length,
    online: MOCK_DEVICES.filter((d) => d.status === 'online').length,
    warning: MOCK_DEVICES.filter((d) => d.status === 'warning').length,
    error: MOCK_DEVICES.filter((d) => d.status === 'error').length,
    offline: MOCK_DEVICES.filter((d) => d.status === 'offline').length,
  }), []);

  return { devices, counts, filter, setFilter, search, setSearch };
}
