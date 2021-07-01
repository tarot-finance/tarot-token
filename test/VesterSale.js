const {
  expectRevert,
  expectAlmostEqualMantissa,
  bnMantissa,
  BN,
} = require("./Utils/JS");

const Tarot = artifacts.require("Tarot");
const VesterSale = artifacts.require("VesterSaleHarness");

const oneMantissa = new BN(10).pow(new BN(18));
const VESTING_AMOUNT = oneMantissa.mul(new BN(80000000));
const VESTING_BEGIN = new BN(1600000000);
const VESTING_PERIOD = new BN(1461 * 24 * 3600);
const VESTING_END = VESTING_BEGIN.add(VESTING_PERIOD);

contract("VesterSale", function (accounts) {
  let root = accounts[0];
  let recipient = accounts[1];

  let tarot;
  let vester;

  before(async () => {
    tarot = await Tarot.new(root);
    vester = await VesterSale.new(
      tarot.address,
      recipient,
      VESTING_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    tarot.transfer(vester.address, VESTING_AMOUNT);
  });

  it("setRecipient", async () => {
    await expectRevert(
      vester.setRecipient(root, { from: root }),
      "Vester: UNAUTHORIZED"
    );
    await vester.setRecipient(root, { from: recipient });
    expect(await vester.recipient()).to.eq(root);
    await vester.setRecipient(recipient, { from: root });
    expect(await vester.recipient()).to.eq(recipient);
  });

  it("too early", async () => {
    await expectRevert(
      VesterSale.new(
        tarot.address,
        recipient,
        VESTING_AMOUNT,
        VESTING_BEGIN,
        VESTING_BEGIN
      ),
      "Vester: END_TOO_EARLY"
    );
  });

  it("claim unauthorized", async () => {
    await expectRevert(vester.claim.call(), "Vester: UNAUTHORIZED");
    await vester.setBlockTimestamp(VESTING_BEGIN.sub(new BN(1)));
    expect((await vester.claim.call({ from: recipient })) * 1).to.eq(0);
  });

  [
    { T: 0, expectedPercentage: 0 },
    { T: 0, expectedPercentage: 0 },
    { T: 1, expectedPercentage: 0.2 },
    { T: 1, expectedPercentage: 0.2 },
    { T: 1262280, expectedPercentage: 0.22106 },
    { T: 20 * 24 * 3600, expectedPercentage: 0.22863 },
    { T: 200 * 24 * 3600, expectedPercentage: 0.44815 },
    { T: 500 * 24 * 3600, expectedPercentage: 0.69526 },
    { T: 1450 * 24 * 3600, expectedPercentage: 0.99857 },
    { T: 1500 * 24 * 3600, expectedPercentage: 1 },
  ].forEach((testCase) => {
    it(`continue vesting curve for ${JSON.stringify(testCase)}`, async () => {
      const { T, expectedPercentage } = testCase;
      const blockTimestamp = VESTING_BEGIN.add(new BN(T));
      await vester.setBlockTimestamp(blockTimestamp);
      const x = blockTimestamp
        .sub(VESTING_BEGIN)
        .mul(oneMantissa)
        .div(VESTING_PERIOD);
      const expectedAmount = VESTING_AMOUNT.mul(
        bnMantissa(expectedPercentage)
      ).div(oneMantissa);
      await vester.claim({ from: recipient });
      expectAlmostEqualMantissa(
        await tarot.balanceOf(recipient),
        expectedAmount
      );
    });
  });
});
