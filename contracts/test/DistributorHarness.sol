pragma solidity =0.6.6;

import "../../contracts/Distributor.sol";

contract DistributorHarness is Distributor {
    constructor(address tarot_, address claimable_) public Distributor(tarot_, claimable_) {}

    function setRecipientShares(address account, uint shares) public virtual {
        Recipient storage recipient = recipients[account];
        uint prevShares = recipient.shares;
        if (prevShares < shares) totalShares = totalShares.add(shares - prevShares);
        else totalShares = totalShares.sub(prevShares - shares);
        recipient.shares = shares;
        recipient.lastShareIndex = shareIndex;
    }

    function editRecipientHarness(address account, uint shares) public virtual {
        editRecipientInternal(account, shares);
    }
}
