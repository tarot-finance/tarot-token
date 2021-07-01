pragma solidity =0.6.6;

import "./libraries/SafeMath.sol";
import "./interfaces/ITarot.sol";
import "./interfaces/IClaimable.sol";
import "./interfaces/IVester.sol";

contract Vester is IVester, IClaimable {
    using SafeMath for uint;

    uint public constant override segments = 100;

    address public immutable tarot;
    address public recipient;

    uint public immutable override vestingAmount;
    uint public immutable override vestingBegin;
    uint public immutable override vestingEnd;

    uint public previousPoint;
    uint public immutable finalPoint;

    constructor(
        address tarot_,
        address recipient_,
        uint vestingAmount_,
        uint vestingBegin_,
        uint vestingEnd_
    ) public {
        require(vestingEnd_ > vestingBegin_, "Vester: END_TOO_EARLY");

        tarot = tarot_;
        recipient = recipient_;

        vestingAmount = vestingAmount_;
        vestingBegin = vestingBegin_;
        vestingEnd = vestingEnd_;

        finalPoint = vestingCurve(1e18);
    }

    function vestingCurve(uint x) public pure virtual returns (uint y) {
        uint speed = 1e18;
        for (uint i = 0; i < 100e16; i += 1e16) {
            if (x < i + 1e16) return y + (speed * (x - i)) / 1e16;
            y += speed;
            speed = (speed * 976) / 1000;
        }
    }

    function getUnlockedAmount() internal virtual returns (uint amount) {
        uint blockTimestamp = getBlockTimestamp();
        uint currentPoint = vestingCurve((blockTimestamp - vestingBegin).mul(1e18).div(vestingEnd - vestingBegin));
        amount = vestingAmount.mul(currentPoint.sub(previousPoint)).div(finalPoint);
        previousPoint = currentPoint;
    }

    function claim() public virtual override returns (uint amount) {
        require(msg.sender == recipient, "Vester: UNAUTHORIZED");
        uint blockTimestamp = getBlockTimestamp();
        if (blockTimestamp < vestingBegin) return 0;
        if (blockTimestamp > vestingEnd) {
            amount = ITarot(tarot).balanceOf(address(this));
        } else {
            amount = getUnlockedAmount();
        }
        if (amount > 0) ITarot(tarot).transfer(recipient, amount);
    }

    function setRecipient(address recipient_) public virtual {
        require(msg.sender == recipient, "Vester: UNAUTHORIZED");
        recipient = recipient_;
    }

    function getBlockTimestamp() public view virtual returns (uint) {
        return block.timestamp;
    }
}
