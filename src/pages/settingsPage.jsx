import { useEffect, useState, useSyncExternalStore } from "react";
import { accountSettingsManager } from "../services/accountSettingsManager";

// 마이 페이지 컴포넌트 (좌측 사이드바: 설정 / 나의 리뷰)
export default function SettingsPage({ onBack, reviews = [], onDeleteReview }) {
  // 싱글톤 매니저의 사용자 프로필 상태를 React와 동기화합니다.
  const profile = useSyncExternalStore(
    accountSettingsManager.subscribe,
    accountSettingsManager.getSnapshot
  );

  // 현재 선택된 사이드바 탭 ("settings" | "reviews")
  const [activeTab, setActiveTab] = useState("settings");

  // 닉네임 변경 폼 상태
  const [nickname, setNickname] = useState(profile ? profile.displayName : "");
  const [nicknameStatus, setNicknameStatus] = useState({ type: "", message: "" });
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  // 비밀번호 변경 폼 상태
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState({ type: "", message: "" });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const profileUid = profile ? profile.uid : "";
  const profileDisplayName = profile ? profile.displayName : "";

  // 로그인 계정이 바뀌거나 닉네임이 갱신되면 입력값과 알림 상태를 초기화합니다.
  useEffect(() => {
    setNickname(profileDisplayName || "");
    setNicknameStatus({ type: "", message: "" });
    setPasswordStatus({ type: "", message: "" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [profileUid, profileDisplayName]);

  // 계정이 바뀌면 기본 탭(설정)으로 되돌립니다.
  useEffect(() => {
    setActiveTab("settings");
  }, [profileUid]);

  // 비로그인 상태로 접근한 경우 안내 화면을 표시합니다.
  if (!profile) {
    return (
      <section className="settings-section">
        <div className="container">
          <div className="settings-card">
            <p className="settings-empty">
              로그인 후 마이 페이지를 이용할 수 있습니다.
            </p>
            <button type="button" className="btn btn-default" onClick={onBack}>
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 현재 로그인한 사용자가 작성한 리뷰만 필터링합니다.
  const myReviews = reviews.filter((item) => item.ownerId === profile.uid);

  // 닉네임 변경 제출 처리
  const handleNicknameSubmit = async (e) => {
    e.preventDefault();
    setNicknameStatus({ type: "", message: "" });

    try {
      setIsSavingNickname(true);
      await accountSettingsManager.updateNickname(nickname);
      setNicknameStatus({
        type: "success",
        message: "닉네임이 변경되었습니다. 새로 작성하는 리뷰부터 적용됩니다.",
      });
    } catch (error) {
      setNicknameStatus({
        type: "error",
        message: error.message || "닉네임 변경 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSavingNickname(false);
    }
  };

  // 비밀번호 변경 제출 처리 (현재 비밀번호 재인증 포함)
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: "", message: "" });

    if (newPassword !== confirmPassword) {
      setPasswordStatus({
        type: "error",
        message: "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.",
      });
      return;
    }

    try {
      setIsSavingPassword(true);
      await accountSettingsManager.changePassword(currentPassword, newPassword);
      // 변경 성공 시 비밀번호 입력란을 즉시 비웁니다.
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus({
        type: "success",
        message: "비밀번호가 안전하게 변경되었습니다.",
      });
    } catch (error) {
      setPasswordStatus({
        type: "error",
        message: error.message || "비밀번호 변경 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <section className="settings-section">
      <div className="container">
        {/* 상단 헤더 영역 */}
        <div className="settings-header">
          <div>
            <span className="settings-eyebrow">My Page</span>
            <h2>마이 페이지</h2>
          </div>
          <button type="button" className="btn btn-default" onClick={onBack}>
            홈으로 돌아가기
          </button>
        </div>

        {/* 좌측 사이드바 + 우측 콘텐츠 레이아웃 */}
        <div className="mypage-layout">
          <aside className="mypage-sidebar">
            <div className="mypage-sidebar-title">내 메뉴</div>
            <nav className="mypage-nav">
              <button
                type="button"
                className={
                  activeTab === "settings"
                    ? "mypage-nav-item active"
                    : "mypage-nav-item"
                }
                onClick={() => setActiveTab("settings")}
              >
                <span>설정</span>
              </button>
              <button
                type="button"
                className={
                  activeTab === "reviews"
                    ? "mypage-nav-item active"
                    : "mypage-nav-item"
                }
                onClick={() => setActiveTab("reviews")}
              >
                <span>나의 리뷰</span>
                <span className="mypage-nav-badge">{myReviews.length}</span>
              </button>
            </nav>
          </aside>

          <div className="mypage-content">
            {activeTab === "settings" ? (
              <>
                <div className="mypage-content-header">
                  <h3>설정</h3>
                </div>

                <div className="settings-grid">
                  {/* 1. 프로필(닉네임) 변경 카드 */}
                  <div className="settings-card">
                    <h3>프로필 정보</h3>
                    <p className="settings-description">
                      현재 로그인한 계정의 닉네임을 변경합니다.
                    </p>

                    <form onSubmit={handleNicknameSubmit}>
                      <div className="settings-form-group">
                        <label htmlFor="settings-email">이메일</label>
                        <input
                          id="settings-email"
                          type="email"
                          className="form-control"
                          value={profile.email}
                          disabled
                        />
                      </div>

                      <div className="settings-form-group">
                        <label htmlFor="settings-nickname">닉네임 (2~20자)</label>
                        <input
                          id="settings-nickname"
                          type="text"
                          className="form-control"
                          placeholder="사용할 닉네임을 입력하세요"
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          maxLength={20}
                          disabled={isSavingNickname}
                        />
                      </div>

                      {nicknameStatus.message && (
                        <div
                          className={
                            nicknameStatus.type === "success"
                              ? "alert alert-success settings-feedback"
                              : "alert alert-danger settings-feedback"
                          }
                        >
                          {nicknameStatus.message}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary settings-submit-btn"
                        disabled={isSavingNickname}
                      >
                        {isSavingNickname ? "저장 중..." : "닉네임 저장"}
                      </button>
                    </form>
                  </div>

                  {/* 2. 비밀번호 변경 카드 */}
                  <div className="settings-card">
                    <h3>비밀번호 변경</h3>
                    <p className="settings-description">
                      보안을 위해 현재 비밀번호를 먼저 확인한 뒤 새 비밀번호로 변경합니다.
                    </p>

                    <form onSubmit={handlePasswordSubmit}>
                      <div className="settings-form-group">
                        <label htmlFor="settings-current-password">현재 비밀번호</label>
                        <input
                          id="settings-current-password"
                          type="password"
                          className="form-control"
                          placeholder="현재 비밀번호"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          disabled={isSavingPassword}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label htmlFor="settings-new-password">새 비밀번호 (6자 이상)</label>
                        <input
                          id="settings-new-password"
                          type="password"
                          className="form-control"
                          placeholder="새 비밀번호"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={isSavingPassword}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label htmlFor="settings-confirm-password">새 비밀번호 확인</label>
                        <input
                          id="settings-confirm-password"
                          type="password"
                          className="form-control"
                          placeholder="새 비밀번호 다시 입력"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={isSavingPassword}
                        />
                      </div>

                      {passwordStatus.message && (
                        <div
                          className={
                            passwordStatus.type === "success"
                              ? "alert alert-success settings-feedback"
                              : "alert alert-danger settings-feedback"
                          }
                        >
                          {passwordStatus.message}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary settings-submit-btn"
                        disabled={isSavingPassword}
                      >
                        {isSavingPassword ? "변경 중..." : "비밀번호 변경"}
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mypage-content-header">
                  <h3>나의 리뷰 ({myReviews.length})</h3>
                </div>

                {myReviews.length === 0 ? (
                  <div className="settings-card">
                    <p className="settings-empty" style={{ marginBottom: 0 }}>
                      아직 작성한 노래 평가가 없습니다. 홈에서 첫 리뷰를 남겨보세요!
                    </p>
                  </div>
                ) : (
                  <div className="my-reviews-list">
                    {myReviews.map((item) => (
                      <div className="my-review-card" key={item.id}>
                        <div className="my-review-top">
                          <div>
                            <h4 className="my-review-song">{item.songTitle}</h4>
                            <span className="my-review-artist">{item.artist}</span>
                          </div>
                          <div className="my-review-rating">
                            {"★".repeat(item.rating)}
                            <span className="my-review-rating-num">
                              {item.rating}점
                            </span>
                          </div>
                        </div>

                        <p className="my-review-comment">{item.comment}</p>

                        {onDeleteReview && (
                          <div className="my-review-actions">
                            <button
                              type="button"
                              className="btn btn-default btn-xs my-review-delete-btn"
                              onClick={() => onDeleteReview(item.id)}
                            >
                              리뷰 삭제
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}