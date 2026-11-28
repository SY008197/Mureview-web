import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { authService } from "./services/authService";
import { accountSettingsManager } from "./services/accountSettingsManager";
import { musicReviewFacade } from "./patterns/musicReviewFacade";
import SettingsPage from "./pages/settingsPage";
import TrackReviewModal from "./components/TrackReviewModal";
import "./App.css";

// Firebase 로그인/회원가입 에러 코드별 사용자 안내 메시지
const AUTH_ERROR_MESSAGES = {
  "auth/invalid-email": "올바른 이메일 형식으로 입력해주세요. (예: name@example.com)",
  "auth/missing-email": "이메일을 입력해주세요.",
  "auth/missing-password": "비밀번호를 입력해주세요.",
  "auth/too-many-requests": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  "auth/network-request-failed": "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
  "auth/operation-not-allowed": "현재 이메일 로그인 기능이 비활성화되어 있습니다.",
  "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "auth/invalid-login-credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "auth/user-not-found": "가입되지 않은 이메일입니다.",
  "auth/wrong-password": "비밀번호가 일치하지 않습니다.",
  "auth/user-disabled": "비활성화된 계정입니다. 관리자에게 문의해주세요.",
  "auth/email-already-in-use": "이미 사용 중인 이메일입니다. 로그인을 시도해주세요.",
  "auth/weak-password": "비밀번호는 6자 이상으로 설정해주세요.",
  "auth/password-does-not-meet-requirements": "비밀번호 보안 조건을 충족하지 않습니다.",
};

function getAuthErrorMessage(error, fallbackMessage) {
  if (error && error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }
  return fallbackMessage;
}

function formatRatingScore(score) {
  const numeric = Number(score || 0);
  return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
}

// Mureview 메인 애플리케이션 컴포넌트 (MusicReviewFacade의 클라이언트)
export default function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState("home");

  const profile = useSyncExternalStore(
    accountSettingsManager.subscribe,
    accountSettingsManager.getSnapshot
  );

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedTrack, setSelectedTrack] = useState(null);

  useEffect(() => {
    const unsubscribe = authService.subscribeAuth((currentUser) => {
      setUser(currentUser);
      accountSettingsManager.syncUser(currentUser);
      setErrorMsg("");

      if (currentUser) {
        setEmail("");
        setPassword("");
      } else {
        setActiveView("home");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleChangeView = (nextView) => {
    setErrorMsg("");
    setActiveView(nextView);
  };

  const handleLogin = async () => {
    setErrorMsg("");
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMsg("이메일을 입력해주세요.");
      return;
    }
    if (!password) {
      setErrorMsg("비밀번호를 입력해주세요.");
      return;
    }

    try {
      await authService.login(trimmedEmail, password);
    } catch (err) {
      setErrorMsg(getAuthErrorMessage(err, "로그인에 실패했습니다. 다시 시도해주세요."));
    }
  };

  const handleSignUp = async () => {
    setErrorMsg("");
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMsg("이메일을 입력해주세요.");
      return;
    }
    if (!password) {
      setErrorMsg("비밀번호를 입력해주세요.");
      return;
    }

    try {
      await authService.signUp(trimmedEmail, password, "");
    } catch (err) {
      setErrorMsg(getAuthErrorMessage(err, "회원가입에 실패했습니다. 다시 시도해주세요."));
    }
  };

  // Facade를 통해 전체 리뷰 조회
  const fetchReviews = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await musicReviewFacade.getAllReviews();
      setReviews(data);
    } catch (err) {
      setErrorMsg("리뷰 목록을 불러오지 못했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Facade를 통해 멜론 검색 + 곡별 평점(미등록 곡 0점 초기화) 조회
  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    try {
      setIsSearching(true);
      setSearchError("");
      setHasSearched(true);

      const results = await musicReviewFacade.searchTracksWithRatings(
        query,
        reviews
      );
      setSearchResults(results);
    } catch (err) {
      setSearchError("노래 검색 중 오류가 발생했습니다: " + err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 리뷰 등록/삭제 시 검색 결과 카드의 평점도 즉시 동기화
  const searchResultsWithRatings = useMemo(
    () => musicReviewFacade.attachRatingsToTracks(searchResults, reviews),
    [searchResults, reviews]
  );

  // 선택된 곡의 팝업용 리뷰 요약 정보 계산
  const selectedTrackReviewSummary = useMemo(() => {
    if (!selectedTrack) {
      return {
        reviews: [],
        averageRating: 0,
        reviewCount: 0,
        hasUserReviewed: false,
      };
    }
    return musicReviewFacade.getTrackReviewSummary(
      selectedTrack.id,
      reviews,
      user
    );
  }, [selectedTrack, reviews, user]);

  // Facade를 통해 곡별 리뷰 등록 (내부에서 중복 차단 + Factory 객체 생성 + 저장 수행)
  const handleSubmitTrackReview = async ({ track, rating, comment }) => {
    setErrorMsg("");
    const updatedReviews = await musicReviewFacade.submitTrackReview({
      track,
      user,
      rating,
      comment,
    });
    setReviews(updatedReviews);
  };

  // Facade를 통해 리뷰 삭제
  const handleDeleteReview = async (reviewId) => {
    try {
      setErrorMsg("");
      const updatedReviews = await musicReviewFacade.deleteReview(reviewId);
      setReviews(updatedReviews);
    } catch {
      setErrorMsg("삭제 권한이 없거나 요청이 거절되었습니다.");
    }
  };

  const headerDisplayName =
    (profile && profile.displayName) || (user && user.email) || "";

  return (
    <div>
      <header
        id="header"
        style={{ padding: "20px 0", borderBottom: "1px solid #eee" }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{ margin: 0, cursor: "pointer" }}
            onClick={() => handleChangeView("home")}
          >
            Mureview
          </h3>
          <div>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ marginRight: "4px" }}>
                  {headerDisplayName}님 환영합니다
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    handleChangeView(activeView === "settings" ? "home" : "settings")
                  }
                >
                  {activeView === "settings" ? "홈으로" : "마이 페이지"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => authService.logout()}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="비밀번호(6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="btn" onClick={handleLogin}>
                  로그인
                </button>
                <button type="button" className="btn" onClick={handleSignUp}>
                  회원가입
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {errorMsg && (
        <div className="container" style={{ marginTop: "16px" }}>
          <div
            className="alert alert-danger"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              aria-label="알림 닫기"
              onClick={() => setErrorMsg("")}
              style={{
                background: "none",
                border: "none",
                fontSize: "18px",
                lineHeight: 1,
                cursor: "pointer",
                color: "inherit",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {user && activeView === "settings" ? (
        <SettingsPage
          onBack={() => handleChangeView("home")}
          reviews={reviews}
          onDeleteReview={handleDeleteReview}
        />
      ) : (
        <>
          <section className="music-search-section">
            <div className="container">
              <div className="music-search-header">
                <span>Music Search</span>
                <h2>노래 · 아티스트 검색</h2>
              </div>

              <form className="music-search-form" onSubmit={handleSearch}>
                <input
                  type="text"
                  className="music-search-input"
                  placeholder="노래 제목이나 아티스트명을 입력하세요"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  type="submit"
                  className="music-search-button"
                  aria-label="검색"
                  disabled={isSearching}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </form>

              {searchError && (
                <p className="music-search-status error">{searchError}</p>
              )}

              {isSearching && (
                <p className="music-search-status">
                  노래 정보를 검색하는 중입니다...
                </p>
              )}

              {!isSearching &&
                hasSearched &&
                !searchError &&
                searchResultsWithRatings.length === 0 && (
                  <p className="music-search-status">
                    검색 결과가 없습니다. 다른 제목이나 아티스트명으로 검색해
                    보세요.
                  </p>
                )}

              {!isSearching && searchResultsWithRatings.length > 0 && (
                <div className="music-results-grid">
                  {searchResultsWithRatings.map((track) => (
                    <div className="music-result-card" key={track.id}>
                      <img
                        className="music-result-cover"
                        src={track.artworkUrl}
                        alt={track.trackName}
                        referrerPolicy="no-referrer"
                      />
                      <div className="music-result-info">
                        <h4
                          className="music-result-title"
                          title={track.trackName}
                        >
                          {track.trackName}
                        </h4>
                        <p
                          className="music-result-artist"
                          title={track.artistName}
                        >
                          {track.artistName}
                        </p>
                        <p
                          className="music-result-album"
                          title={track.albumName}
                        >
                          {track.albumName}
                        </p>

                        <div className="music-result-rating">
                          <span className="review-star-icon">★</span>
                          <span className="music-result-rating-score">
                            {formatRatingScore(track.averageRating)}점
                          </span>
                          <span className="music-result-rating-count">
                            ({track.reviewCount})
                          </span>
                        </div>

                        <div className="music-card-actions">
                          {track.musicUrl && (
                            <a
                              className="music-ytm-link"
                              style={{ backgroundColor: "#4883ff" }}
                              href={track.musicUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              음원 정보 보기
                            </a>
                          )}
                          <button
                            type="button"
                            className="music-review-btn"
                            onClick={() => setSelectedTrack(track)}
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            <span>리뷰 작성</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="featured-places" id="blog">
            <div className="container">
              <div className="section-heading">
                <span>Song Reviews</span>
                <h2>최근 등록된 노래 평가</h2>
              </div>

              {loading ? (
                <p style={{ textAlign: "center" }}>
                  데이터를 불러오는 중입니다...
                </p>
              ) : reviews.length === 0 ? (
                <p style={{ textAlign: "center" }}>
                  아직 등록된 노래 평가가 없습니다. 원하는 곡을 검색해 첫 평가를
                  남겨보세요!
                </p>
              ) : (
                <div className="row">
                  {reviews.map((item) => (
                    <div className="col-md-4 col-sm-6 col-xs-12" key={item.id}>
                      <div className="featured-item">
                        <div className="thumb">
                          <img
                            src={item.artworkUrl || "/img/featured_item_1.jpg"}
                            alt={item.songTitle}
                            referrerPolicy="no-referrer"
                          />
                          <div className="overlay-content">
                            <ul>
                              {Array.from({ length: item.rating }).map(
                                (_, idx) => (
                                  <li key={idx}>
                                    <i className="fa fa-star"></i>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                        <div className="down-content">
                          <h4>{item.songTitle}</h4>
                          <span>
                            {item.artist} · 작성자: {item.authorName}
                          </span>
                          <p>{item.comment}</p>
                          {user && user.uid === item.ownerId && (
                            <div className="row">
                              <div className="col-md-12">
                                <div className="text-button">
                                  <a
                                    href="#delete"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDeleteReview(item.id);
                                    }}
                                  >
                                    내 리뷰 삭제하기
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <TrackReviewModal
        track={selectedTrack}
        user={user}
        trackReviews={selectedTrackReviewSummary.reviews}
        averageRating={selectedTrackReviewSummary.averageRating}
        reviewCount={selectedTrackReviewSummary.reviewCount}
        hasUserReviewed={selectedTrackReviewSummary.hasUserReviewed}
        onClose={() => setSelectedTrack(null)}
        onSubmitReview={handleSubmitTrackReview}
        onDeleteReview={handleDeleteReview}
      />
    </div>
  );
}