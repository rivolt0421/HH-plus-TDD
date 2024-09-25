import { Injectable } from '@nestjs/common';
import { UserPointRepository } from 'src/point/user-point.repository';
import { UserPointTable } from './userpoint.table';
import { UserPoint } from 'src/point/point.model';

@Injectable()
export class UserPointRepositoryImpl implements UserPointRepository {
  constructor(private readonly database: UserPointTable) {}
  findUserPointById(id: number): Promise<UserPoint> {
    return this.database.selectById(id);
  }

  upsertUserPoint(userPoint: UserPoint): Promise<UserPoint> {
    return this.database.insertOrUpdate(userPoint.id, userPoint.point);
  }
}
