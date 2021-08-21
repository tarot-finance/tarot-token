pragma solidity =0.6.6;

import "./interfaces/IERC20.sol";
import "./interfaces/IOwnedDistributor.sol";
import "./interfaces/IUniswapV2Router01.sol";
import "./libraries/SafeMath.sol";
import "./libraries/SafeToken.sol";

contract LiquidityGenerator {
    using SafeMath for uint256;
    using SafeToken for address;

    address public immutable admin;
    address public immutable tarot;
    address public immutable router0;
    address public immutable router1;
    address public immutable pair0;
    address public immutable pair1;
    address public immutable reservesManager;
    address public immutable distributor;
    address public immutable bonusDistributor;
    uint public immutable periodBegin;
    uint public immutable periodEnd;
    uint public immutable bonusEnd;
    uint public immutable sharesRouter0;
    uint public immutable sharesRouter1;
    uint public immutable totalRouterShares;
    uint public unlockTimestamp;
    bool public finalized = false;
    bool public delivered = false;

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

    constructor(
        address admin_,
        address tarot_,
        address router0_,
        address router1_,
        address pair0_,
        address pair1_,
        address reservesManager_,
        address distributor_,
        address bonusDistributor_,
        uint periodBegin_,
        uint periodDuration_,
        uint bonusDuration_,
        uint sharesRouter0_,
        uint sharesRouter1_
    ) public {
        require(periodDuration_ > 0, "LiquidityGenerator: INVALID_PERIOD_DURATION");
        require(bonusDuration_ > 0 && bonusDuration_ <= periodDuration_, "LiquidityGenerator: INVALID_BONUS_DURATION");
        admin = admin_;
        tarot = tarot_;
        router0 = router0_;
        router1 = router1_;
        pair0 = pair0_;
        pair1 = pair1_;
        reservesManager = reservesManager_;
        distributor = distributor_;
        bonusDistributor = bonusDistributor_;
        periodBegin = periodBegin_;
        periodEnd = periodBegin_.add(periodDuration_);
        bonusEnd = periodBegin_.add(bonusDuration_);
        sharesRouter0 = sharesRouter0_;
        sharesRouter1 = sharesRouter1_;
        totalRouterShares = sharesRouter0_.add(sharesRouter1_);
    }

    function distributorTotalShares() public view returns (uint totalShares) {
        return IOwnedDistributor(distributor).totalShares();
    }

    function bonusDistributorTotalShares() public view returns (uint totalShares) {
        return IOwnedDistributor(bonusDistributor).totalShares();
    }

    function distributorRecipients(address account)
        public
        view
        returns (
            uint shares,
            uint lastShareIndex,
            uint credit
        )
    {
        return IOwnedDistributor(distributor).recipients(account);
    }

    function bonusDistributorRecipients(address account)
        public
        view
        returns (
            uint shares,
            uint lastShareIndex,
            uint credit
        )
    {
        return IOwnedDistributor(bonusDistributor).recipients(account);
    }

    function postponeUnlockTimestamp(uint newUnlockTimestamp) public {
        require(msg.sender == admin, "LiquidityGenerator: UNAUTHORIZED");
        require(newUnlockTimestamp > unlockTimestamp, "LiquidityGenerator: INVALID_UNLOCK_TIMESTAMP");
        uint prevUnlockTimestamp = unlockTimestamp;
        unlockTimestamp = newUnlockTimestamp;
        emit PostponeUnlockTimestamp(prevUnlockTimestamp, unlockTimestamp);
    }

    function deliverLiquidityToReservesManager() public {
        require(msg.sender == admin, "LiquidityGenerator: UNAUTHORIZED");
        require(!delivered, "LiquidityGenerator: ALREADY_DELIVERED");
        require(finalized, "LiquidityGenerator: NOT_FINALIZED");
        uint blockTimestamp = getBlockTimestamp();
        require(blockTimestamp >= unlockTimestamp, "LiquidityGenerator: STILL_LOCKED");
        uint _amountPair0 = pair0.myBalance();
        uint _amountPair1 = pair1.myBalance();
        pair0.safeTransfer(reservesManager, _amountPair0);
        pair1.safeTransfer(reservesManager, _amountPair1);
        delivered = true;
        emit Delivered(_amountPair0, _amountPair1);
    }

    function finalize() public {
        require(!finalized, "LiquidityGenerator: FINALIZED");
        uint blockTimestamp = getBlockTimestamp();
        require(blockTimestamp >= periodEnd, "LiquidityGenerator: TOO_SOON");
        uint _amountTarot = tarot.myBalance();
        uint _amountETH = address(this).balance;

        uint _amountTarot1 = _amountTarot.mul(sharesRouter1).div(totalRouterShares);
        uint _amountETH1 = _amountETH.mul(sharesRouter1).div(totalRouterShares);
        uint _amountTarot0 = _amountTarot.sub(_amountTarot1);
        uint _amountETH0 = _amountETH.sub(_amountETH1);

        tarot.safeApprove(router0, _amountTarot0);
        tarot.safeApprove(router1, _amountTarot1);
        IUniswapV2Router01(router0).addLiquidityETH{value: _amountETH0}(
            tarot,
            _amountTarot0,
            _amountTarot0,
            _amountETH0,
            address(this),
            blockTimestamp
        );
        IUniswapV2Router01(router1).addLiquidityETH{value: _amountETH1}(
            tarot,
            _amountTarot1,
            _amountTarot1,
            _amountETH1,
            address(this),
            blockTimestamp
        );
        unlockTimestamp = blockTimestamp.add(60 * 60 * 24 * 180);
        finalized = true;
        emit Finalized(_amountTarot, _amountETH);
    }

    function deposit() external payable {
        uint blockTimestamp = getBlockTimestamp();
        require(blockTimestamp >= periodBegin, "LiquidityGenerator: TOO_SOON");
        require(blockTimestamp < periodEnd, "LiquidityGenerator: TOO_LATE");
        require(msg.value >= 1e19, "LiquidityGenerator: INVALID_VALUE");
        (uint _prevSharesBonus, , ) = IOwnedDistributor(bonusDistributor).recipients(msg.sender);
        uint _newSharesBonus = _prevSharesBonus;
        if (blockTimestamp < bonusEnd) {
            _newSharesBonus = _prevSharesBonus.add(msg.value);
            IOwnedDistributor(bonusDistributor).editRecipient(msg.sender, _newSharesBonus);
        }
        (uint _prevShares, , ) = IOwnedDistributor(distributor).recipients(msg.sender);
        uint _newShares = _prevShares.add(msg.value);
        IOwnedDistributor(distributor).editRecipient(msg.sender, _newShares);
        emit Deposit(
            msg.sender,
            msg.value,
            distributorTotalShares(),
            bonusDistributorTotalShares(),
            _newShares,
            _newSharesBonus
        );
    }

    receive() external payable {
        revert("LiquidityGenerator: BAD_CALL");
    }

    function getBlockTimestamp() public view virtual returns (uint) {
        return block.timestamp;
    }
}
