import { useEffect, useState, useSyncExternalStore } from "react";
import { authService } from "./services/authService";
import { accountSettingsManager } from "./services/accountSettingsManager";
import { reviewRepository } from "./repositories/reviewRepository";
import SettingsPage from "./pages/settingsPage";
import "./App.css";

// Mureview 메인 애플리케이션 컴포넌트
export default function App() {
  // 인증 및 화면 전환 상태 ("home" | "settings")
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState("home");

  // 싱글톤 매니저의 사용자 프로필 상태를 React와 동기화
  const profile = useSyncExternalStore(
    accountSettingsManager.subscribe,
    accountSettingsManager.getSnapshot
  );

  // 리뷰 목록 및 로딩/에러 상태
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // 새 리뷰 작성 폼 상태
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  // 로그인/회원가입 입력 상태
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 음원 검색 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Firebase 인증 상태 구독 및 싱글톤 매니저 동기화
  useEffect(() => {
    const unsubscribe = authService.subscribeAuth((currentUser) => {
      setUser(currentUser);
      accountSettingsManager.syncUser(currentUser);

      // 로그아웃 시 설정 페이지에 머물지 않도록 홈으로 복귀
      if (!currentUser) {
        setActiveView("home");
      }
    });

    return () => unsubscribe();
  }, []);

  // 전체 리뷰 목록 조회
  const fetchReviews = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await reviewRepository.getAllReviews();
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

  // 음원 검색 API 요청 처리
  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    try {
      setIsSearching(true);
      setSearchError("");
      setHasSearched(true);

      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "검색 요청에 실패했습니다.");
      }

      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError("노래 검색 중 오류가 발생했습니다: " + err.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 새 노래 평가 등록 처리
  const handleCreateReview = async (e) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg("로그인 후 노래 평가를 등록할 수 있습니다.");
      return;
    }
    if (!songTitle.trim() || !artist.trim() || !comment.trim()) {
      setErrorMsg("노래 제목, 가수, 감상평을 모두 입력해주세요.");
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMsg("평점은 1점에서 5점 사이여야 합니다.");
      return;
    }

    // 싱글톤에 반영된 최신 닉네임을 우선 사용하여 작성자명 결정
    const authorName =
      (profile && profile.displayName) ||
      user.displayName ||
      user.email.split("@")[0];

    try {
      setErrorMsg("");
      await reviewRepository.createReview({
        ownerId: user.uid,
        authorName,
        songTitle: songTitle.trim(),
        artist: artist.trim(),
        rating: Number(rating),
        comment: comment.trim(),
      });

      setSongTitle("");
      setArtist("");
      setRating(5);
      setComment("");
      await fetchReviews();
    } catch (err) {
      setErrorMsg("저장에 실패했습니다: " + err.message);
    }
  };

  // 내 리뷰 삭제 처리
  const handleDeleteReview = async (reviewId) => {
    try {
      setErrorMsg("");
      await reviewRepository.deleteReview(reviewId);
      await fetchReviews();
    } catch {
      setErrorMsg("삭제 권한이 없거나 요청이 거절되었습니다.");
    }
  };

  // 헤더에 표시할 사용자 이름 (설정된 닉네임 우선, 없으면 이메일)
  const headerDisplayName =
    (profile && profile.displayName) || (user && user.email) || "";

  return (
    <div>
      {/* 상단 네비게이션 헤더 */}
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
            onClick={() => setActiveView("home")}
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
                    setActiveView((prev) =>
                      prev === "settings" ? "home" : "settings"
                    )
                  }
                >
                  {activeView === "settings" ? "홈으로" : "설정"}
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
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    authService
                      .login(email, password)
                      .catch((e) => setErrorMsg("로그인 실패: " + e.message))
                  }
                >
                  로그인
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    authService
                      .signUp(email, password, "")
                      .catch((e) => setErrorMsg("회원가입 실패: " + e.message))
                  }
                >
                  회원가입
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 전역 에러 알림 영역 */}
      {errorMsg && (
        <div className="container" style={{ marginTop: "16px" }}>
          <div className="alert alert-danger">{errorMsg}</div>
        </div>
      )}

      {/* 현재 뷰 상태에 따라 설정 페이지 또는 메인 홈 렌더링 */}
      {user && activeView === "settings" ? (
        <SettingsPage onBack={() => setActiveView("home")} />
      ) : (
        <>
          {/* 음원 검색 섹션 */}
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
                searchResults.length === 0 && (
                  <p className="music-search-status">
                    검색 결과가 없습니다. 다른 제목이나 아티스트명으로 검색해
                    보세요.
                  </p>
                )}

              {!isSearching && searchResults.length > 0 && (
                <div className="music-results-grid">
                  {searchResults.map((track) => (
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 로그인 사용자용 새 노래 평가 등록 폼 */}
          {user && (
            <section
              className="container"
              style={{ marginTop: "30px", marginBottom: "20px" }}
            >
              <h4>새 노래 평가 등록</h4>
              <form onSubmit={handleCreateReview} className="row">
                <div className="col-md-3">
                  <input
                    className="form-control"
                    placeholder="노래 제목"
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <input
                    className="form-control"
                    placeholder="아티스트"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <select
                    className="form-control"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((num) => (
                      <option key={num} value={num}>
                        ★ {num}점
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className="col-md-4"
                  style={{ display: "flex", gap: "8px" }}
                >
                  <input
                    className="form-control"
                    placeholder="한줄평을 입력하세요"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">
                    등록
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* 최근 등록된 노래 평가 목록 */}
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
                  아직 등록된 노래 평가가 없습니다. 로그인 후 첫 평가를
                  남겨보세요!
                </p>
              ) : (
                <div className="row">
                  {reviews.map((item) => (
                    <div className="col-md-4 col-sm-6 col-xs-12" key={item.id}>
                      <div className="featured-item">
                        <div className="thumb">
                          <img
                            src="/img/featured_item_1.jpg"
                            alt={item.songTitle}
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
    </div>
  );
}