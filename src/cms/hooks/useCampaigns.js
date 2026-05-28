import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const STATUSES = {
  draft: { label: 'Черновик', badge: 'draft' },
  pending_approval: { label: 'Ожидает согласования', badge: 'pending' },
  active: { label: 'Активна', badge: 'active' },
  completed: { label: 'Завершена', badge: 'completed' },
  error: { label: 'Ошибка / Сбой', badge: 'error' },
  paused: { label: 'Приостановлена', badge: 'paused' },
};

const LOCATIONS = [
  { id: 'loc-1', name: 'Нур Алем' },
  { id: 'loc-2', name: 'Нурлы Жол' },
  { id: 'loc-3', name: 'Mega Silk Way' },
  { id: 'loc-4', name: 'Khan Shatyr' },
  { id: 'loc-5', name: 'ТРЦ Керуен' },
  { id: 'loc-6', name: 'Байтерек Tower' },
  { id: 'loc-7', name: 'Expo Boulevard' },
  { id: 'loc-8', name: 'Достык Плаза' },
];

function randomFrom(arr, min = 1, max = 3) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function computeAutoStatus(campaign) {
  if (campaign.status === 'draft' || campaign.status === 'pending_approval' || campaign.status === 'error' || campaign.status === 'paused') {
    return campaign.status;
  }

  const now = new Date();
  const start = new Date(campaign.startAt);
  const end = new Date(campaign.endAt);

  if (now < start) return 'pending_approval';
  if (now >= start && now <= end) return 'active';
  if (now > end) return 'completed';

  return campaign.status;
}

function generateMockCampaigns(count = 86) {
  const types = ['commercial', 'navigation'];
  const typeLabels = { commercial: 'Коммерческая', navigation: 'Обязательная навигация' };
  const names = [
    'Coca-Cola Лето 2026', 'Samsung Galaxy S27 Launch', 'Air Astana Promo',
    'Kaspi Bank Кредит', 'Halyk Bank Депозиты', 'Freedom Mobile 5G',
    'Magnum Акция', 'Sulpak Tech Days', 'Wolt Доставка', 'Glovo Express',
    'Arbuz.kz Скидки', 'Kolesa Auto Sale', 'Aviata Перелёты',
    'Beeline Безлимит', 'Tele2 Тариф Smart', 'МЧС Пожарная безопасность',
    'МИОР Навигация', 'Astana Hub Fest', 'Digital Bridge 2026',
    'QazCloud Summit', 'Kcell 4G+', 'Forte Bank Ипотека',
    'Choco Family', 'iDoctor Здоровье', 'Technodom Распродажа',
    'BTS Group Навигация', 'Astana Marathon', 'Qazaq Air Route Map',
    'BI Group Жилой Комплекс', 'KEGOC Энергоэффективность',
  ];
  const statusPool = ['draft', 'pending_approval', 'active', 'completed', 'error', 'paused'];

  const campaigns = [];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const baseName = names[i % names.length];
    const suffix = i >= names.length ? ` #${Math.floor(i / names.length) + 1}` : '';
    const rawStatus = statusPool[Math.floor(Math.random() * statusPool.length)];

    const startAt = randomDate(new Date('2026-04-01'), new Date('2026-07-01'));
    const endAt = new Date(startAt.getTime() + (7 + Math.floor(Math.random() * 60)) * 24 * 3600 * 1000);

    const targets = randomFrom(LOCATIONS);

    const campaign = {
      id: `cmp-${String(i + 1).padStart(4, '0')}`,
      name: `${baseName}${suffix}`,
      type,
      typeLabel: typeLabels[type],
      status: rawStatus,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      targets: targets.map((l) => ({ id: l.id, name: l.name })),
      priority: ['low', 'normal', 'high', 'emergency'][Math.floor(Math.random() * 4)],
      impressions: Math.floor(Math.random() * 50000),
      createdAt: randomDate(new Date('2026-01-01'), startAt).toISOString(),
    };

    campaign.status = computeAutoStatus(campaign);
    campaigns.push(campaign);
  }

  return campaigns;
}

const ALL_MOCK = generateMockCampaigns(86);

function simulateServerFetch(allData, params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let filtered = [...allData];

      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
        );
      }

      if (params.statuses?.length) {
        filtered = filtered.filter((c) => params.statuses.includes(c.status));
      }

      if (params.startDate) {
        const sd = new Date(params.startDate);
        filtered = filtered.filter((c) => new Date(c.endAt) >= sd);
      }
      if (params.endDate) {
        const ed = new Date(params.endDate);
        filtered = filtered.filter((c) => new Date(c.startAt) <= ed);
      }

      if (params.locationIds?.length) {
        filtered = filtered.filter((c) =>
          c.targets.some((t) => params.locationIds.includes(t.id)),
        );
      }

      const total = filtered.length;
      const page = params.page || 1;
      const limit = params.limit || 15;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const data = filtered.slice(start, start + limit);

      const statusCounts = {};
      for (const c of allData) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      }

      resolve({ data, meta: { total, page, limit, totalPages }, statusCounts });
    }, 400 + Math.random() * 600);
  });
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 15, totalPages: 0 });
  const [statusCounts, setStatusCounts] = useState({});

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [locationIds, setLocationIds] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await simulateServerFetch(ALL_MOCK, {
        search: debouncedSearch,
        statuses,
        startDate,
        endDate,
        locationIds,
        page,
        limit,
      });

      const withAutoStatus = result.data.map((c) => ({
        ...c,
        status: computeAutoStatus(c),
      }));

      setCampaigns(withAutoStatus);
      setMeta(result.meta);
      setStatusCounts(result.statusCounts);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statuses, startDate, endDate, locationIds, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statuses, startDate, endDate, locationIds]);

  const toggleStatus = useCallback((status) => {
    setStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }, []);

  const toggleLocation = useCallback((locId) => {
    setLocationIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId],
    );
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatuses([]);
    setStartDate('');
    setEndDate('');
    setLocationIds([]);
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () => search || statuses.length || startDate || endDate || locationIds.length,
    [search, statuses, startDate, endDate, locationIds],
  );

  return {
    campaigns,
    loading,
    meta,
    statusCounts,
    page,
    setPage,
    search,
    setSearch,
    statuses,
    toggleStatus,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    locationIds,
    toggleLocation,
    resetFilters,
    hasActiveFilters,
    refetch: fetchData,
    STATUSES,
    LOCATIONS,
  };
}
