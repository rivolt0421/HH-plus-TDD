import { PointHistory } from './point.model';

export const PointHistoryRepositoryToken = Symbol('PointHistoryRepository');

export interface PointHistoryRepository {
  findPointHistoriesByUserId(userId: number): Promise<PointHistory[]>;
  saveHistory(history: Omit<PointHistory, 'id'>): Promise<PointHistory>;
}
