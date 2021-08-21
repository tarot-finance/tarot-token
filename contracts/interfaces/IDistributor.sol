pragma solidity >=0.5.0;

interface IDistributor {
    function totalShares() external view returns (uint);

    function recipients(address)
        external
        view
        returns (
            uint shares,
            uint lastShareIndex,
            uint credit
        );
}
