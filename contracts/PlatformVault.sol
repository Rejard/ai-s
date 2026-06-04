// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PlatformVault
 * @dev 회원 가입비 및 월정액을 수납하여 1차/2차 추천인에게 균등 분배(각 25%)하고 나머지는 본사(Owner)로 전송하는 플랫폼 금고 스마트 컨트랙트
 */
contract PlatformVault {
    address public owner;
    IERC20 public usdtToken;

    event CollectedAndDistributed(
        address indexed user,
        address indexed referrer1,
        address indexed referrer2,
        uint256 amount,
        uint256 ref1Amount,
        uint256 ref2Amount,
        uint256 ownerAmount
    );
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "PlatformVault: caller is not the owner");
        _;
    }

    constructor(address _usdtTokenAddress) {
        owner = msg.sender;
        usdtToken = IERC20(_usdtTokenAddress);
    }

    /**
     * @dev 사용자의 Approve 권한을 이용해 금액을 인출하고, 2단계 균등 분배를 실행
     * @param user 가입비를 납부할 회원 지갑 주소
     * @param referrer1 1차 직접 추천인 지갑 주소 (없으면 address(0))
     * @param referrer2 2차 상위 추천인 지갑 주소 (없으면 address(0))
     * @param amount 청구할 금액 (USDT 단위, 6 decimals)
     */
    function collectAndDistribute(
        address user,
        address referrer1,
        address referrer2,
        uint256 amount
    ) external onlyOwner returns (bool) {
        require(user != address(0), "PlatformVault: invalid user address");
        require(amount > 0, "PlatformVault: amount must be greater than zero");

        // 1. 사용자로부터 플랫폼 금고(Vault)로 USDT를 인출 (Approve 필요)
        bool pulled = usdtToken.transferFrom(user, address(this), amount);
        require(pulled, "PlatformVault: USDT pull failed");

        uint256 ref1Share = 0;
        uint256 ref2Share = 0;

        // 2. 1차 추천인 배분 (25%)
        if (referrer1 != address(0) && referrer1 != user) {
            ref1Share = (amount * 25) / 100;
            bool success1 = usdtToken.transfer(referrer1, ref1Share);
            require(success1, "PlatformVault: distribution to referrer1 failed");
        }

        // 3. 2차 추천인 배분 (25%)
        if (referrer2 != address(0) && referrer2 != user && referrer2 != referrer1) {
            ref2Share = (amount * 25) / 100;
            bool success2 = usdtToken.transfer(referrer2, ref2Share);
            require(success2, "PlatformVault: distribution to referrer2 failed");
        }

        // 4. 본사(Owner) 정산 (나머지 금액 전체)
        uint256 ownerShare = amount - ref1Share - ref2Share;
        if (ownerShare > 0) {
            bool successOwner = usdtToken.transfer(owner, ownerShare);
            require(successOwner, "PlatformVault: distribution to owner failed");
        }

        emit CollectedAndDistributed(
            user,
            referrer1,
            referrer2,
            amount,
            ref1Share,
            ref2Share,
            ownerShare
        );

        return true;
    }

    /**
     * @dev 본사 관리자(Owner) 주소 변경
     */
    function changeOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "PlatformVault: invalid new owner address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @dev 금고 계약에 오입금된 다른 토큰이나 수수료가 남았을 때 소유주가 긴급 인출
     */
    function emergencyWithdrawToken(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(0), "PlatformVault: invalid token address");
        IERC20(tokenAddress).transfer(owner, amount);
    }
}
