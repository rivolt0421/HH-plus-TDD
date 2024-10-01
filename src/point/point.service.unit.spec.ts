import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointRepositoryToken } from './user-point.repository';
import { PointHistoryRepositoryToken } from './point-history.repository';
import { LockManager } from '../lock-manager/lock-manager';

/**
 * 포인트 서비스의 주요 기능인 충전, 사용, 조회 기능을 테스트합니다.
 *
 * 조회
 *  - 유저의 포인트 정보가 존재하지 않으면, 초기값이 반환됩니다.
 *  - 충전 시 유저의 포인트 정보가 존재하지 않으면 새롭게 생성하기 때문에,
 *    조회 시 유저의 포인트 정보가 존재하지 않더라도 에러를 발생시키지 않고 고의적으로 초기값을 반환하도록 했습니다.
 *
 * 사용
 *  - 사용 요청 금액이 현재 포인트 잔액보다 크면 에러를 발생시킵니다.
 */
describe('PointService 테스트', () => {
  let pointService: PointService;
  let userPointRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        LockManager,
        {
          provide: UserPointRepositoryToken,
          useValue: {
            findUserPointById: jest.fn(),
            upsertUserPoint: jest.fn(),
          },
        },
        {
          provide: PointHistoryRepositoryToken,
          useValue: {
            saveHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    pointService = module.get<PointService>(PointService);
    userPointRepository = module.get(UserPointRepositoryToken);
  });

  describe('조회', () => {
    test('유저의 포인트 정보가 존재하지 않으면 초기값이 반환된다.', async () => {
      userPointRepository.findUserPointById.mockResolvedValue(null);
      const result = await pointService.getUserPoint(1);
      expect(result).toEqual({
        id: 1,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });
  });

  describe('충전', () => {
    test('유저의 현재 잔액에서 amount 만큼 포인트가 증가한다.', async () => {
      userPointRepository.findUserPointById.mockResolvedValue({
        id: 1,
        point: 100,
        updateMillis: Date.now(),
      });
      userPointRepository.upsertUserPoint.mockImplementation((userPoint) => {
        return Promise.resolve(userPoint);
      });
      const result = await pointService.chargePoint(1, 100);
      expect(result.point).toBe(200);
    });

    test('유저의 포인트 정보가 존재하지 않으면, 초기값으로부터 계산한다.', async () => {
      userPointRepository.findUserPointById.mockResolvedValue(null);
      userPointRepository.upsertUserPoint.mockImplementation((userPoint) => {
        return Promise.resolve(userPoint);
      });
      const result = await pointService.chargePoint(1, 100);
      expect(result.point).toBe(100);
    });
  });

  describe('사용', () => {
    test('유저의 현재 잔액보다 사용액이 더 크면 에러를 발생시킨다.', async () => {
      userPointRepository.findUserPointById.mockResolvedValue({
        id: 1,
        point: 50,
        updateMillis: Date.now(),
      });
      await expect(pointService.usePoint(1, 100)).rejects.toThrow(
        '포인트 잔액이 부족합니다.',
      );
    });

    test('유저의 현재 잔액에서 amount 만큼 포인트가 감소한다.', async () => {
      userPointRepository.findUserPointById.mockResolvedValue({
        id: 1,
        point: 100,
        updateMillis: Date.now(),
      });
      userPointRepository.upsertUserPoint.mockImplementation((userPoint) => {
        return Promise.resolve(userPoint);
      });
      const result = await pointService.usePoint(1, 50);
      expect(result.point).toBe(50);
    });

    test('유저의 포인트 정보가 존재하지 않으면, 초기값으로부터 계산한다.', async () => {
      userPointRepository.findUserPointById.mockResolvedValue(null);
      await expect(pointService.usePoint(1, 50)).rejects.toThrow(
        '포인트 잔액이 부족합니다.',
      );
    });
  });
});
