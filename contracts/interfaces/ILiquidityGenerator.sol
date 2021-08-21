pragma solidity =0.6.6;

interface ILiquidityGenerator {
    function periodBegin() external pure returns (uint);

    function periodEnd() external pure returns (uint);

    function bonusEnd() external pure returns (uint);

    function distributor() external pure returns (address);

    function bonusDistributor() external pure returns (address);

    function distributorTotalShares() external view returns (uint);

    function bonusDistributorTotalShares() external view returns (uint);

    function distributorRecipients(address)
        external
        view
        returns (
            uint shares,
            uint lastShareIndex,
            uint credit
        );

    function bonusDistributorRecipients(address)
        external
        view
        returns (
            uint shares,
            uint lastShareIndex,
            uint credit
        );

    function deposit() external payable;

    event Finalized(uint amountTarot, uint amountETH);
    event Deposit(
        address indexed sender,
        uint amount,
        uint distributorTotalShares,
        uint bonusDistributorTotalShares,
        uint newShares,
        uint newBonusShares
    );
    event PostponeUnlockTimestamp(uint prevUnlockTimestamp, uint unlockTimestamp);
    event Delivered(uint amountPair0, uint amountPair1);
}
