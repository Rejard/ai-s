// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PlatformVault
 * @dev Platform vault smart contract that collects member Registration Fee and monthly fees, evenly distributes (25% each) to 1st/2nd referrers, and transfers the rest to the Platform Owner
 */
contract PlatformVault {
    address public owner;
    IERC20 public paymentToken;

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

    constructor(address _paymentTokenAddress) {
        owner = msg.sender;
        paymentToken = IERC20(_paymentTokenAddress);
    }

    /**
     * @dev Uses user's Approve permission to Withdrawal funds and execute 2-step even Distribution
     * @param user Member wallet address to pay Registration Fee
     * @param referrer1 1st direct referrer wallet address (address(0) if none)
     * @param referrer2 2nd upper referrer wallet address (address(0) if none)
     * @param amount Amount to be charged (in USDT, 6 decimals)
     */
    function collectAndDistribute(
        address user,
        address referrer1,
        address referrer2,
        uint256 amount
    ) external onlyOwner returns (bool) {
        require(user != address(0), "PlatformVault: invalid user address");
        require(amount > 0, "PlatformVault: amount must be greater than zero");

        // 1. Withdrawal funds from user to platform vault (Approve required)
        bool pulled = paymentToken.transferFrom(user, address(this), amount);
        require(pulled, "PlatformVault: Token pull failed");

        uint256 ref1Share = 0;
        uint256 ref2Share = 0;

        // 2. 1st referrer Distribution (25%)
        if (referrer1 != address(0) && referrer1 != user) {
            ref1Share = (amount * 25) / 100;
            bool success1 = paymentToken.transfer(referrer1, ref1Share);
            require(success1, "PlatformVault: distribution to referrer1 failed");
        }

        // 3. 2nd referrer Distribution (25%)
        if (referrer2 != address(0) && referrer2 != user && referrer2 != referrer1) {
            ref2Share = (amount * 25) / 100;
            bool success2 = paymentToken.transfer(referrer2, ref2Share);
            require(success2, "PlatformVault: distribution to referrer2 failed");
        }

        // 4. Platform Owner settlement (entire remaining amount)
        uint256 ownerShare = amount - ref1Share - ref2Share;
        if (ownerShare > 0) {
            bool successOwner = paymentToken.transfer(owner, ownerShare);
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
     * @dev Change Platform Owner address
     */
    function changeOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "PlatformVault: invalid new owner address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @dev Emergency withdrawal by the owner when other tokens or fees incorrectly deposited remain in the vault contract
     */
    function emergencyWithdrawToken(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(0), "PlatformVault: invalid token address");
        IERC20(tokenAddress).transfer(owner, amount);
    }
}
