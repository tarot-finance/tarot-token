pragma solidity =0.6.6;

import "../interfaces/ITarot.sol";
import "../interfaces/IClaimable.sol";

contract MockClaimable is IClaimable {
    address public immutable tarot;
    address public recipient;

    constructor(address tarot_, address recipient_) public {
        tarot = tarot_;
        recipient = recipient_;
    }

    function setRecipient(address recipient_) public {
        recipient = recipient_;
    }

    function claim() public override returns (uint amount) {
        amount = ITarot(tarot).balanceOf(address(this));
        ITarot(tarot).transfer(recipient, amount);
    }
}
