import { reviewRepository } from "../repositories/reviewRepository";
import { accountSettingsManager } from "../services/accountSettingsManager";
import { ReviewFactory } from "./reviewFactory";

/**
 * [Facade Pattern]
 * MusicReviewFacade
 *
 * 복잡한 하위 서브시스템들(음원 검색 API, 계정 프로필 싱글톤, 리뷰 팩토리, Firestore 리포지토리)을
 * 하나의 단순한 인터페이스로 감싸 UI 클라이언트(App.jsx)와의 결합도를 낮춥니다.
 *
 * 캡슐화하는 서브시스템:
 *  1. 멜론 검색 API (/api/search)
 *  2. accountSettingsManager (로그인 사용자 프로필 싱글톤)
 *  3. ReviewFactory (리뷰 및 평점 요약 객체 생성 팩토리)
 *  4. reviewRepository (Firestore 리뷰 저장소)
 */
export class MusicReviewFacade {
  constructor({
    repository = reviewRepository,
    settingsManager = accountSettingsManager,
    factory = ReviewFactory,
  } = {}) {
    this._repository = repository;
    this._settingsManager = settingsManager;
    this._factory = factory;
  }

  /** 전체 리뷰 목록 조회 */
  async getAllReviews() {
    return this._repository.getAllReviews();
  }

  /**
   * 멜론 음원 검색 + 각 곡의 평균 평점 결합 (리뷰 없는 곡은 0점으로 초기화)
   */
  async searchTracksWithRatings(query, existingReviews = null) {
    const trimmedQuery = String(query || "").trim();
    if (!trimmedQuery) {
      return [];
    }

    // Subsystem 1: 멜론 검색 API 호출
    const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "검색 요청에 실패했습니다.");
    }

    const tracks = data.results || [];
    // Subsystem 4: 기존 리뷰 목록 확보
    const allReviews = Array.isArray(existingReviews)
      ? existingReviews
      : await this._repository.getAllReviews();

    return this.attachRatingsToTracks(tracks, allReviews);
  }

  /**
   * 검색된 트랙 배열에 최신 리뷰 기준 평균 평점(0점 초기화 포함)을 매핑
   */
  attachRatingsToTracks(tracks = [], allReviews = []) {
    const reviewsByTrackId = new Map();

    allReviews.forEach((review) => {
      if (!review || !review.trackId) return;
      const list = reviewsByTrackId.get(review.trackId) || [];
      list.push(review);
      reviewsByTrackId.set(review.trackId, list);
    });

    return tracks.map((track) => {
      const trackReviews = reviewsByTrackId.get(track.id) || [];
      // Subsystem 3: Factory로 평점 요약 객체 생성
      const summary = this._factory.createRatingSummary(trackReviews);

      return {
        ...track,
        averageRating: summary.averageRating,
        reviewCount: summary.reviewCount,
      };
    });
  }

  /**
   * 특정 곡 팝업용 리뷰 목록, 평균 평점, 현재 사용자 중복 작성 여부 조회
   * (비로그인 사용자도 열람 가능)
   */
  getTrackReviewSummary(trackId, allReviews = [], currentUser = null) {
    const trackReviews = allReviews.filter(
      (review) => review && review.trackId === trackId
    );
    const summary = this._factory.createRatingSummary(trackReviews);
    const hasUserReviewed = Boolean(
      currentUser &&
        trackReviews.some((review) => review.ownerId === currentUser.uid)
    );

    return {
      reviews: trackReviews,
      averageRating: summary.averageRating,
      reviewCount: summary.reviewCount,
      hasUserReviewed,
    };
  }

  /**
   * 특정 멜론 곡에 리뷰 등록 (인증 확인 -> 중복 차단 -> 팩토리 생성 -> DB 저장 -> 최신 목록 반환)
   */
  async submitTrackReview({ track, user, rating, comment }) {
    if (!user || !user.uid) {
      throw new Error("로그인 후 리뷰를 작성할 수 있습니다.");
    }

    // Subsystem 4: 동일 곡 중복 리뷰 여부 검사
    const alreadyReviewed = await this._repository.hasUserReviewedTrack(
      track.id,
      user.uid
    );
    if (alreadyReviewed) {
      throw new Error("이미 이 곡에 리뷰를 작성하셨습니다. 중복 작성은 불가능합니다.");
    }

    // Subsystem 2: 싱글톤에서 최신 사용자 프로필 조회
    const profile = this._settingsManager.getSnapshot();

    // Subsystem 3: 팩토리로 검증된 TrackReview 도메인 객체 생성
    const trackReview = this._factory.createTrackReview({
      track,
      user,
      profile,
      rating,
      comment,
    });

    // Subsystem 4: Firestore 저장 후 최신 전체 리뷰 목록 반환
    await this._repository.createReview(trackReview.toFirestoreData());
    return this._repository.getAllReviews();
  }

  /** 리뷰 삭제 후 최신 전체 리뷰 목록 반환 */
  async deleteReview(reviewId) {
    await this._repository.deleteReview(reviewId);
    return this._repository.getAllReviews();
  }
}

export const musicReviewFacade = new MusicReviewFacade();