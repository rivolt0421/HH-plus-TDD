# 동시성 제어 방식 분석


동시성 제어는 여러 요청이 동시에 실행될 때 데이터의 일관성과 무결성을 유지하기 위한 기법입니다.

주요 방식은 다음과 같이 분류할 수 있습니다:

#### 낙관적 방법 (Optimistic Concurrency Control)
- 충돌이 드물게 발생한다고 가정하고, 트랜잭션을 먼저 실행한 후 커밋 시점에 충돌을 검사합니다.
- 예: 버전 관리, 타임스탬프 기반 검증

#### 비관적 방법 (Pessimistic Concurrency Control)
- 충돌이 자주 발생한다고 가정하고, 트랜잭션 실행 전에 락을 획득합니다.
- 예: 락킹 (Locking), 타임스탬프 순서화 (Timestamp Ordering)

## 구현 방식 선택: 락킹 (Locking)

본 과제에서는 비관적 방법 중 락킹 방식을 선택하여 구현했습니다. 

### 선택 이유
1. **요구 사항**: 포인트 시스템의 특성상 동일 사용자에 대한 요청은 순차적으로 처리되어야 하는데, 락킹 방식은 이러한 요구사항을 충족할 수 있습니다.

2. **Node.js 환경 적합성**: Node.js의 이벤트 루프와 Promise를 활용하여 효율적으로 락킹을 구현할 수 있습니다.

3. **구현 및 디버깅 용이성**: 락킹 방식은 직관적이어서 구현과 디버깅이 상대적으로 쉽습니다.

### 구현
```typescript
export class LockManager {
  private locks: Record<number, Promise<any>[]> = {};

  async doWithLock<T>(lockNumber: number, task: () => Promise<T>): Promise<T> {
    if (!this.locks[lockNumber]) {
      this.locks[lockNumber] = [];
    }

    const isFirst = this.locks[lockNumber].length === 0;
    const waitingTasks = this.locks[lockNumber];

    let unlock = () => {};
    const taskLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    waitingTasks.push(taskLock);

    if (!isFirst) {
      await waitingTasks.at(-2);
    }

    try {
      return await task();
    } catch (e) {
      throw e;
    } finally {
      // 이 시점에서 현재 task 의 인덱스는 0이다.
      waitingTasks.splice(0, 1);
      unlock();
    }
  }
}
```

1. **구조**:
   - `locks` 객체는 각 `lockNumber`(예: 사용자 ID)에 대한 대기 중인 작업들의 Promise 배열을 저장합니다.
   - 이 구조를 통해 각 사용자별로 독립적인 락 큐를 관리할 수 있습니다.

2. **획득 프로세스**:
   - 새로운 작업이 들어오면, 해당 `lockNumber`에 대한 Promise(`taskLock`)를 생성하고 대기 큐에 추가합니다.
   - 만약 이 작업이 큐의 첫 번째 작업이 아니라면, 이전 작업의 완료를 기다립니다 (`await waitingTasks.at(-2)`).

### 단점 및 고려사항
1. **메모리 사용**: 높은 동시성 환경에서 메모리 사용량이 지나치게 높아질 수 있습니다.
2. **성능 오버헤드**: 또한 락 관리에 따른 오버헤드가 발생할 수 있습니다.
3. **인메모리 한계**: 락 관리를 메모리에서 하는 것이 결국 분산 환경과 장애 상황에 대응할 수 없는 이유이기도 해서, 추가적인 고려가 필요합니다.

