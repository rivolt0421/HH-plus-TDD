import { Injectable } from '@nestjs/common';
import { PointHistoryRepository } from 'src/point/point-history.repository';
import { PointHistory } from 'src/point/point.model';
import { PointHistoryTable } from './pointhistory.table';

@Injectable()
export class PointHistoryRepositoryImpl implements PointHistoryRepository {
  constructor(private readonly database: PointHistoryTable) {}

  findPointHistoriesByUserId(userId: number): Promise<PointHistory[]> {
    return this.database.selectAllByUserId(userId);
  }
  saveHistory(history: PointHistory): Promise<PointHistory> {
    return this.database.insert(
      history.userId,
      history.amount,
      history.type,
      history.timeMillis,
    );
  }
}
