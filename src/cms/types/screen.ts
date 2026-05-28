export enum ScreenStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline',
}

export interface Screen {
  id: string;
  organizationId: string;
  name: string;
  location: string;
  slotsCount: number;
  occupiedSlots: number;
  monthlyCost: number;
  status: ScreenStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScreenPayload {
  name: string;
  location: string;
  slotsCount: number;
  monthlyCost: number;
  status?: ScreenStatus;
}

export interface UpdateScreenPayload {
  name?: string;
  location?: string;
  slotsCount?: number;
  occupiedSlots?: number;
  monthlyCost?: number;
  status?: ScreenStatus;
}

export interface ScreenQuery {
  status?: ScreenStatus;
  location?: string;
}

export const SCREEN_STATUS_LABELS: Record<ScreenStatus, string> = {
  [ScreenStatus.ACTIVE]: 'Активен',
  [ScreenStatus.MAINTENANCE]: 'Обслуживание',
  [ScreenStatus.OFFLINE]: 'Офлайн',
};
