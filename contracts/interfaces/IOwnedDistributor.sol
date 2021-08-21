pragma solidity >=0.5.0;

interface IOwnedDistributor {
    function totalShares() external view returns (uint);

    function recipients(address)
        external
        view
        returns (
            uint shares,
            uint lastShareIndex,
            uint credit
        );

    function editRecipient(address account, uint shares) external;
}
