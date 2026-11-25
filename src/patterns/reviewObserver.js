// 1. Subject (관찰 대상 / 발행자)
export class Subject {
  constructor() {
    this.observers = new Set();
  }

  subscribe(observer) {
    if (typeof observer?.update !== "function") {
      throw new Error("Observer는 반드시 update(event) 메서드를 가져야 합니다.");
    }
    this.observers.add(observer);
    return () => this.unsubscribe(observer);
  }

  unsubscribe(observer) {
    this.observers.delete(observer);
  }

  notify(event) {
    this.observers.forEach((observer) => {
      observer.update(event);
    });
  }
}

// 2. ConcreteSubject (리뷰 이벤트 발행 주체)
class ReviewSubject extends Subject {
  notifyReviewCreated(review) {
    this.notify({
      type: "REVIEW_CREATED",
      payload: review,
      timestamp: new Date().toISOString(),
    });
  }

  notifyReviewDeleted(reviewInfo) {
    this.notify({
      type: "REVIEW_DELETED",
      payload: reviewInfo,
      timestamp: new Date().toISOString(),
    });
  }
}

export const reviewSubject = new ReviewSubject();

// 3. ConcreteObserver (활동 로그 기록 옵저버)
export class ReviewActivityLogger {
  constructor(onLog) {
    this.onLog = onLog;
  }

  update(event) {
    if (event.type === "REVIEW_CREATED") {
      this.onLog(
        `[등록] ${event.payload.authorName}님이 "${event.payload.songTitle}" (★${event.payload.rating}) 평가`
      );
    } else if (event.type === "REVIEW_DELETED") {
      this.onLog(`[삭제] "${event.payload.songTitle}" 리뷰가 삭제되었습니다.`);
    }
  }
}