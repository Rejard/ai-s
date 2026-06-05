
pragma solidity ^0.8.20;

/**
 * @title MockUSDT
 * @dev Virtual USDT Token (6 decimals) for testing on Polygon Amoy Testnet
 */
contract MockUSDT {
    string public name = "Mock Tether USD";
    string public symbol = "USDT";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {

        _mint(msg.sender, 1000000 * 10**decimals);
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "ERC20: transfer amount exceeds balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(balanceOf[from] >= value, "ERC20: transferFrom amount exceeds balance");
        require(allowance[from][msg.sender] >= value, "ERC20: transferFrom amount exceeds allowance");

        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    /**
     * @dev Faucet for testing: Allows anyone to receive 1,000 USDT for free to their address for testing
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
}
