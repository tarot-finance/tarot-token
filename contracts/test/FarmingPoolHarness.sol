pragma solidity =0.6.6;

import "../../contracts/FarmingPool.sol";

contract FarmingPoolHarness is FarmingPool {
    constructor(
        address tarot_,
        address claimable_,
        address borrowable_,
        address vester_
    ) public FarmingPool(tarot_, claimable_, borrowable_, vester_) {}

    uint _blockTimestamp;

    function getBlockTimestamp() public view virtual override returns (uint) {
        return _blockTimestamp;
    }

    function setBlockTimestamp(uint blockTimestamp) public {
        _blockTimestamp = blockTimestamp;
    }
}
