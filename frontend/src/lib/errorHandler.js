export function translateError(error) {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  // 1. Web3 / Wallet / Transaction Error Handling
  const errMsg = error?.message || String(error);

  if (
    error?.code === 4001 ||
    errMsg.includes('ACTION_REJECTED') ||
    errMsg.includes('rejected') ||
    errMsg.includes('User rejected')
  ) {
    return '[사용자 취소] 지갑에서 요청한 거래 승인(서명)이 취소되었습니다. 거래를 완료하시려면 다시 승인을 진행해 주세요.';
  }

  if (error?.code === 'INSUFFICIENT_POL_FOR_GAS' || errMsg.includes('INSUFFICIENT_POL_FOR_GAS')) {
    return '[수수료 부족] 블록체인 이체 수수료로 쓰일 폴리곤(POL) 잔액이 부족합니다. 지갑에 소량의 POL을 충전하신 뒤 다시 시도해 주세요.';
  }

  if (errMsg.includes('NO_TRUST_WALLET')) {
    return '[지갑 설정 필요] 트러스트 월렛(Trust Wallet) 앱이 설치되지 않았거나 연동되지 않았습니다. 플레이 스토어 등 공식 마켓에서 앱을 설치한 뒤 실행 상태를 확인해 주세요.';
  }

  if (
    errMsg.includes('could not coalesce error') ||
    errMsg.includes('eth_getBalance') ||
    errMsg.includes('UNKNOWN_ERROR') ||
    errMsg.includes('JsonRpcProvider')
  ) {
    return '[지갑/네트워크 불안정] 현재 블록체인 응답 노드가 매우 혼잡하여 접속이 지연되고 있습니다. 지갑 앱을 강제 종료 후 다시 켜시거나, 와이파이를 끄고 모바일 데이터(LTE/5G) 상태에서 다시 시도해 주세요.';
  }

  // 2. HTTP (Axios) Request Error Handling
  if (error.response) {
    const status = error.response.status;
    const serverMessage = error.response.data?.message;

    // 서버에서 한글 검증 오류(비즈니스 밸리데이션)를 반환한 경우 (예: "이미 가입 승인된 회원입니다.")
    if (
      serverMessage &&
      typeof serverMessage === 'string' &&
      !serverMessage.includes('SQLITE_') &&
      !serverMessage.includes('UNIQUE constraint') &&
      !serverMessage.includes('Error:') &&
      !/^[a-zA-Z\s]+$/.test(serverMessage)
    ) {
      return `[가입/신청 제한] ${serverMessage}`;
    }

    switch (status) {
      case 403:
        return '[접속 차단 안내] 안전한 금융 거래를 위해 현재 사용 중이신 인터넷망(공유기/와이파이) 접속이 제한되었습니다. 기기의 와이파이를 끄고 모바일 데이터(LTE/5G)로 접속하시거나 다른 네트워크 환경에서 접속해 주세요.';
      case 404:
        return '[서비스 조회 오류] 요청하신 자산 정보 또는 페이지의 경로를 시스템에서 찾을 수 없습니다. 주소창의 경로가 맞는지 확인해 주시거나 담당 매니저에게 복구를 문의해 주세요.';
      case 500:
        return '[시스템 오류 안내] 자산 처리 서버 내부 연동이 일시적으로 중단되었습니다. 이는 서비스 제공측의 일시적 오류이오니, 배정되신 담당 매니저에게 점검을 문의하시거나 잠시 후 다시 거래를 요청해 주세요.';
      case 502:
      case 504:
        return '[서버 혼잡 안내] 현재 많은 투자자의 접속으로 인해 자산 서버가 일시적으로 과부하 상태이거나 긴급 정기 점검 중입니다. 서비스 제공측에서 정상화 중이오니 잠시 대기하신 뒤 화면을 새로고침해 주세요.';
      case 505:
        return '[브라우저 호환 권장] 사용 중이신 인터넷 브라우저 앱은 본 금융 서비스 보안 규격과 호환되지 않습니다. 안전한 자산 관리를 위해 구글 크롬(Chrome) 브라우저를 다운로드하여 접속해 주세요.';
      default:
        return `[시스템 통신 오류] 서버 통신 중 일시적인 오류(코드: ${status})가 발생했습니다. 잠시 후 다시 시도해 주시고 현상이 지속되면 담당 매니저에게 문의해 주세요.`;
    }
  }

  // 3. Network Connection Issue (Offline, Timeout)
  if (errMsg === 'Network Error' || errMsg.includes('timeout') || errMsg.includes('NetworkError')) {
    return '[네트워크 확인 필요] 인터넷 연결 신호가 불안정하여 자산 서버와 통신할 수 없습니다. 기기의 와이파이 수신 상태 또는 모바일 네트워크 연결 상태를 확인해 주세요.';
  }

  return `[미분류 오류] ${errMsg}`;
}

export function showFriendlyError(error, customPrefix = '처리에 실패했습니다.') {
  const message = translateError(error);
  alert(`${customPrefix}\n\n${message}`);
}
