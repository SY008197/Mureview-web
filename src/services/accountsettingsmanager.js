import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase/config";

/**
 * Firebase Auth 에러 코드를 사용자 친화적인 한국어 메시지로 변환하기 위한 매핑 객체
 */
const FIREBASE_ERROR_MESSAGES = {
  "auth/wrong-password": "현재 비밀번호가 일치하지 않습니다.",
  "auth/invalid-credential": "현재 비밀번호가 일치하지 않거나 인증 정보가 올바르지 않습니다.",
  "auth/weak-password": "새 비밀번호는 6자 이상으로 입력해주세요.",
  "auth/requires-recent-login": "보안을 위해 다시 로그인한 뒤 비밀번호를 변경해주세요.",
  "auth/too-many-requests": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  "auth/network-request-failed": "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
};

/**
 * Firebase 에러 객체를 읽기 쉬운 메시지로 포맷팅하는 헬퍼 함수
 */
function formatAuthError(error, fallbackMessage) {
  if (error && error.code && FIREBASE_ERROR_MESSAGES[error.code]) {
    return FIREBASE_ERROR_MESSAGES[error.code];
  }
  return error && error.message
    ? `${fallbackMessage}: ${error.message}`
    : fallbackMessage;
}

/**
 * AccountSettingsManager (Singleton Pattern)
 *
 * 현재 브라우저 세션에 로그인한 사용자의 프로필(닉네임) 및 보안 설정(비밀번호)을
 * 애플리케이션 전역에서 단 하나의 인스턴스로 일관되게 관리합니다.
 * - 실제 데이터는 Firebase Auth에 사용자(uid)별로 분리 저장됩니다.
 * - 비밀번호는 보안을 위해 싱글톤 메모리에 절대 저장하지 않습니다.
 */
export class AccountSettingsManager {
  constructor() {
    // 이미 인스턴스가 생성된 경우 직접 new 호출을 차단하여 단일 인스턴스를 보장합니다.
    if (AccountSettingsManager._instance) {
      throw new Error(
        "AccountSettingsManager는 싱글톤입니다. AccountSettingsManager.getInstance()를 사용하세요."
      );
    }

    // 현재 로그인한 사용자의 프로필 캐시 ({ uid, email, displayName } 또는 null)
    this._profile = null;

    // 상태 변경을 구독하는 리스너(React 컴포넌트 등) 목록
    this._listeners = new Set();

    // React의 useSyncExternalStore에 메서드를 직접 전달할 때 this 바인딩이 유지되도록 고정합니다.
    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
  }

  /**
   * 싱글톤 인스턴스를 반환합니다. (최초 호출 시 1회만 생성)
   */
  static getInstance() {
    if (!AccountSettingsManager._instance) {
      AccountSettingsManager._instance = new AccountSettingsManager();
    }
    return AccountSettingsManager._instance;
  }

  /**
   * 상태 변경 구독 등록 (React useSyncExternalStore 연동용)
   * 반환되는 함수를 호출하면 구독이 해제됩니다.
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * 현재 캐시된 사용자 프로필 스냅샷을 반환합니다.
   * 상태가 변하지 않았을 때 동일한 객체 참조를 반환해야 불필요한 리렌더링을 방지합니다.
   */
  getSnapshot() {
    return this._profile;
  }

  /**
   * 구독 중인 모든 리스너에게 상태 변경을 알립니다.
   */
  _notify() {
    this._listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("AccountSettingsManager 리스너 실행 중 오류:", err);
      }
    });
  }

  /**
   * Firebase 인증 상태(onAuthStateChanged)와 싱글톤 내부 상태를 동기화합니다.
   * 로그인 또는 계정 전환 시 호출합니다.
   */
  syncUser(user) {
    if (!user) {
      this.reset();
      return;
    }

    const nextProfile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
    };

    // 기존 프로필과 모든 값이 동일하면 불필요한 알림을 생략합니다.
    if (
      this._profile &&
      this._profile.uid === nextProfile.uid &&
      this._profile.email === nextProfile.email &&
      this._profile.displayName === nextProfile.displayName
    ) {
      return;
    }

    this._profile = nextProfile;
    this._notify();
  }

  /**
   * 로그아웃 시 이전 사용자의 프로필 캐시를 초기화합니다.
   */
  reset() {
    if (this._profile === null) {
      return;
    }
    this._profile = null;
    this._notify();
  }

  /**
   * 현재 로그인한 사용자의 닉네임(displayName)을 변경합니다.
   */
  async updateNickname(newNickname) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("로그인된 사용자만 닉네임을 변경할 수 있습니다.");
    }

    const trimmed = String(newNickname || "").trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      throw new Error("닉네임은 공백 제외 2자 이상 20자 이하로 입력해주세요.");
    }

    try {
      // 1. Firebase Auth 프로필 업데이트
      await updateProfile(user, { displayName: trimmed });

      // 2. 싱글톤 내부 캐시를 새 객체로 갱신하고 구독자에게 알림
      this._profile = {
        uid: user.uid,
        email: user.email || "",
        displayName: trimmed,
      };
      this._notify();

      return this._profile;
    } catch (error) {
      throw new Error(formatAuthError(error, "닉네임 변경에 실패했습니다"));
    }
  }

  /**
   * 현재 비밀번호로 본인 재인증 후 새 비밀번호로 변경합니다.
   */
  async changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error("이메일 로그인 사용자만 비밀번호를 변경할 수 있습니다.");
    }

    if (!currentPassword) {
      throw new Error("현재 비밀번호를 입력해주세요.");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("새 비밀번호는 6자 이상 입력해주세요.");
    }

    if (currentPassword === newPassword) {
      throw new Error("새 비밀번호는 현재 비밀번호와 다르게 설정해주세요.");
    }

    try {
      // 1. 이메일 + 현재 비밀번호로 자격 증명 생성 및 재인증
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. 재인증 성공 시 비밀번호 변경
      await updatePassword(user, newPassword);
    } catch (error) {
      throw new Error(formatAuthError(error, "비밀번호 변경에 실패했습니다"));
    }
  }
}

// 정적 프로퍼티 초기화
AccountSettingsManager._instance = null;

// 애플리케이션 전역에서 공유할 단일 싱글톤 인스턴스 내보내기
export const accountSettingsManager = AccountSettingsManager.getInstance();