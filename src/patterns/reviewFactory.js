const DEFAULT_ARTWORK_URL = "/img/featured_item_1.jpg";

/**
 * [Factory Pattern - Product 1]
 * 멜론 음원 정보 + 사용자 정보 + 입력값을 표준화한 리뷰 도메인 객체
 */
export class TrackReview {
  constructor({
    trackId,
    ownerId,
    authorName,
    songTitle,
    artist,
    albumName,
    artworkUrl,
    musicUrl,
    rating,
    comment,
  }) {
    this.trackId = trackId;
    this.ownerId = ownerId;
    this.authorName = authorName;
    this.songTitle = songTitle;
    this.artist = artist;
    this.albumName = albumName;
    this.artworkUrl = artworkUrl;
    this.musicUrl = musicUrl;
    this.rating = rating;
    this.comment = comment;
  }

  /** Firestore 저장용 순수 데이터 객체로 변환 */
  toFirestoreData() {
    return {
      trackId: this.trackId,
      ownerId: this.ownerId,
      authorName: this.authorName,
      songTitle: this.songTitle,
      artist: this.artist,
      albumName: this.albumName,
      artworkUrl: this.artworkUrl,
      musicUrl: this.musicUrl,
      rating: this.rating,
      comment: this.comment,
    };
  }
}

/**
 * [Factory Pattern - Product 2]
 * 특정 곡의 평균 평점 및 리뷰 개수 요약 객체 (리뷰가 없으면 0점으로 초기화)
 */
export class TrackRatingSummary {
  constructor(averageRating = 0, reviewCount = 0) {
    this.averageRating = averageRating;
    this.reviewCount = reviewCount;
  }
}

/**
 * [Factory Pattern - Creator]
 * 클라이언트가 리뷰 데이터 구조나 유효성 규칙을 직접 알지 않고도
 * 일관된 리뷰 도메인 객체와 평점 요약 객체를 생성할 수 있도록 캡슐화합니다.
 */
export class ReviewFactory {
  /**
   * 멜론 트랙 + 로그인 사용자 + 입력값으로 검증된 TrackReview 객체 생성
   */
  static createTrackReview({ track, user, profile, rating, comment }) {
    if (!user || !user.uid) {
      throw new Error("로그인 후 노래 평가를 등록할 수 있습니다.");
    }

    if (!track || !track.id || !track.trackName || !track.artistName) {
      throw new Error("리뷰를 등록할 음원 정보가 올바르지 않습니다.");
    }

    const trimmedComment = String(comment || "").trim();
    if (!trimmedComment) {
      throw new Error("한줄평을 입력해주세요.");
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new Error("평점은 1점에서 5점 사이의 정수여야 합니다.");
    }

    const authorName =
      (profile && profile.displayName) ||
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "익명");

    return new TrackReview({
      trackId: String(track.id),
      ownerId: user.uid,
      authorName,
      songTitle: String(track.trackName).trim(),
      artist: String(track.artistName).trim(),
      albumName: String(track.albumName || "").trim(),
      artworkUrl: track.artworkUrl || DEFAULT_ARTWORK_URL,
      musicUrl: track.musicUrl || "",
      rating: numericRating,
      comment: trimmedComment,
    });
  }

  /**
   * 특정 곡의 리뷰 목록으로 TrackRatingSummary 생성 (리뷰가 없는 곡은 0점으로 초기화)
   */
  static createRatingSummary(trackReviews = []) {
    if (!Array.isArray(trackReviews) || trackReviews.length === 0) {
      return new TrackRatingSummary(0, 0);
    }

    const validRatings = trackReviews
      .map((item) => Number(item.rating))
      .filter((score) => Number.isFinite(score) && score >= 1 && score <= 5);

    if (validRatings.length === 0) {
      return new TrackRatingSummary(0, 0);
    }

    const sum = validRatings.reduce((acc, score) => acc + score, 0);
    const averageRating = Math.round((sum / validRatings.length) * 10) / 10;

    return new TrackRatingSummary(averageRating, validRatings.length);
  }
}