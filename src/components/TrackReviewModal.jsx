import { useEffect, useState } from "react";

function formatRatingScore(score) {
  const numeric = Number(score || 0);
  return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
}

/**
 * 검색한 음원의 리뷰 조회 및 작성을 위한 팝업 모달 컴포넌트
 * - 비로그인 사용자도 다른 사람들의 리뷰 목록을 확인할 수 있습니다.
 * - 로그인 사용자는 아직 작성하지 않은 곡에 한해 1회 리뷰를 남길 수 있습니다.
 */
export default function TrackReviewModal({
  track,
  user,
  trackReviews = [],
  averageRating = 0,
  reviewCount = 0,
  hasUserReviewed = false,
  onClose,
  onSubmitReview,
  onDeleteReview,
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setRating(5);
    setComment("");
    setFormError("");
    setIsSubmitting(false);
  }, [track?.id]);

  useEffect(() => {
    if (!track) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [track, onClose]);

  if (!track) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!user) {
      setFormError("로그인 후 리뷰를 작성할 수 있습니다.");
      return;
    }

    if (hasUserReviewed) {
      setFormError("이미 이 곡에 리뷰를 작성하셨습니다. 중복 작성은 불가능합니다.");
      return;
    }

    if (!comment.trim()) {
      setFormError("한줄평을 입력해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitReview({
        track,
        rating: Number(rating),
        comment: comment.trim(),
      });
      setRating(5);
      setComment("");
    } catch (err) {
      setFormError(err.message || "리뷰 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="review-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-review-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="review-modal">
        <div className="review-modal-header">
          <div>
            <span className="review-modal-eyebrow">Track Reviews</span>
            <h3 id="track-review-modal-title">음원 리뷰</h3>
          </div>
          <button
            type="button"
            className="review-modal-close"
            aria-label="팝업 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="review-modal-track">
          <img
            className="review-modal-cover"
            src={track.artworkUrl || "/img/featured_item_1.jpg"}
            alt={track.trackName}
            referrerPolicy="no-referrer"
          />
          <div className="review-modal-track-meta">
            <h4 className="review-modal-track-title">{track.trackName}</h4>
            <p className="review-modal-track-artist">{track.artistName}</p>
            {track.albumName && (
              <p className="review-modal-track-album">{track.albumName}</p>
            )}
            <div className="review-modal-score-pill">
              <span className="review-star-icon">★</span>
              <strong>{formatRatingScore(averageRating)}점</strong>
              <span className="review-modal-score-count">
                ({reviewCount}개의 리뷰)
              </span>
            </div>
          </div>
        </div>

        <div className="review-modal-form-section">
          <h4>리뷰 작성</h4>

          {!user ? (
            <div className="review-modal-notice">
              로그인 후 이 곡의 리뷰를 작성할 수 있습니다. 아래에서 다른 사람들의
              리뷰를 확인해보세요.
            </div>
          ) : hasUserReviewed ? (
            <div className="review-modal-notice review-modal-notice-warn">
              이미 이 곡에 리뷰를 작성하셨습니다. 같은 곡에는 중복으로 리뷰를
              남길 수 없습니다.
            </div>
          ) : (
            <form className="review-modal-form" onSubmit={handleSubmit}>
              <div className="review-modal-form-row">
                <select
                  className="form-control review-modal-rating-select"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  disabled={isSubmitting}
                >
                  {[5, 4, 3, 2, 1].map((num) => (
                    <option key={num} value={num}>
                      ★ {num}점
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-control review-modal-comment-input"
                  placeholder="이 곡에 대한 한줄평을 입력하세요"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  className="btn btn-primary review-modal-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "등록 중..." : "등록"}
                </button>
              </div>
              {formError && (
                <p className="review-modal-form-error">{formError}</p>
              )}
            </form>
          )}
        </div>

        <div className="review-modal-list-section">
          <h4>등록된 리뷰 ({reviewCount})</h4>

          {trackReviews.length === 0 ? (
            <p className="review-modal-empty">
              아직 이 곡에 등록된 리뷰가 없습니다. 첫 번째 리뷰를 남겨보세요!
            </p>
          ) : (
            <div className="review-modal-list">
              {trackReviews.map((item) => (
                <div className="review-modal-item" key={item.id}>
                  <div className="review-modal-item-top">
                    <span className="review-modal-author">
                      작성자: {item.authorName}
                    </span>
                    <span className="review-modal-item-rating">
                      {"★".repeat(item.rating)}
                      <span className="review-modal-item-rating-num">
                        {item.rating}점
                      </span>
                    </span>
                  </div>
                  <p className="review-modal-item-comment">{item.comment}</p>
                  {user && user.uid === item.ownerId && onDeleteReview && (
                    <div className="review-modal-item-actions">
                      <button
                        type="button"
                        className="btn btn-default btn-xs my-review-delete-btn"
                        onClick={() => onDeleteReview(item.id)}
                      >
                        내 리뷰 삭제하기
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}