
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

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

    function collectAndDistribute(
        address user,
        address referrer1,
        address referrer2,
        uint256 amount
    ) external onlyOwner returns (bool) {
        require(user != address(0), "PlatformVault: invalid user address");
        require(amount > 0, "PlatformVault: amount must be greater than zero");

        bool pulled = paymentToken.transferFrom(user, address(this), amount);
        require(pulled, "PlatformVault: Token pull failed");

        uint256 ref1Share = 0;
        uint256 ref2Share = 0;

        if (referrer1 != address(0) && referrer1 != user) {
            ref1Share = (amount * 25) / 100;
            bool success1 = paymentToken.transfer(referrer1, ref1Share);
            require(success1, "PlatformVault: distribution to referrer1 failed");
        }

        if (referrer2 != address(0) && referrer2 != user && referrer2 != referrer1) {
            ref2Share = (amount * 25) / 100;
            bool success2 = paymentToken.transfer(referrer2, ref2Share);
            require(success2, "PlatformVault: distribution to referrer2 failed");
        }

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

    function changeOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "PlatformVault: invalid new owner address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }

    function emergencyWithdrawToken(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(0), "PlatformVault: invalid token address");
        IERC20(tokenAddress).transfer(owner, amount);
    }
}
