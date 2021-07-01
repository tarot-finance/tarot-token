pragma solidity =0.6.6;

//IERC20
interface ITarot {
    function balanceOf(address account) external view returns (uint);

    function transfer(address dst, uint rawAmount) external returns (bool);
}
