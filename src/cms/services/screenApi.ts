import api from './api';
import type {
  Screen,
  CreateScreenPayload,
  UpdateScreenPayload,
  ScreenQuery,
} from '../types/screen';

export const screenApi = {
  async getAll(query?: ScreenQuery): Promise<Screen[]> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.location) params.set('location', query.location);

    const { data } = await api.get<Screen[]>('/screens', { params });
    return data;
  },

  async getById(id: string): Promise<Screen> {
    const { data } = await api.get<Screen>(`/screens/${id}`);
    return data;
  },

  async create(payload: CreateScreenPayload): Promise<Screen> {
    const { data } = await api.post<Screen>('/screens', payload);
    return data;
  },

  async update(id: string, payload: UpdateScreenPayload): Promise<Screen> {
    const { data } = await api.patch<Screen>(`/screens/${id}`, payload);
    return data;
  },
};
