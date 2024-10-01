import { UserPoint } from './point.model';

export const UserPointRepositoryToken = Symbol('UserPointRepository');

export interface UserPointRepository {
  findUserPointById(id: number): Promise<UserPoint | null>;
  upsertUserPoint(userPoint: UserPoint): Promise<UserPoint>;
}
