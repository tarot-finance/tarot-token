const {
  expectEqual,
  expectEvent,
  expectRevert,
  expectAlmostEqualMantissa,
  bnMantissa,
  BN,
} = require("./Utils/JS");
const { address, increaseTime, encode } = require("./Utils/Ethereum");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const SpookyFactory = artifacts.require(
  "test/Contracts/spooky/UniswapV2Factory.sol:UniswapV2Factory"
);
const SpookyRouter = artifacts.require(
  "test/Contracts/spooky/UniswapV2Router02.sol:UniswapV2Router02"
);

const Tarot = artifacts.require("Tarot");
const Vester = artifacts.require("Vester");
const VesterSale = artifacts.require("VesterSale");
const VesterStepped = artifacts.require("VesterStepped");
const OwnedDistributor = artifacts.require("OwnedDistributor");
const InitializedDistributor = artifacts.require("InitializedDistributor");
const FarmingPool = artifacts.require("FarmingPool");
const LiquidityGenerator = artifacts.require("LiquidityGenerator");

const MockERC20 = artifacts.require("MockERC20");
const WETH9 = artifacts.require("WETH9");
const UniswapV2Pair = artifacts.require(
  "test/Contracts/spooky/UniswapV2Factory.sol:UniswapV2Pair"
);
const TarotPriceOracle = artifacts.require("TarotPriceOracle");
const Factory = artifacts.require("Factory");
const BDeployer = artifacts.require("BDeployer");
const CDeployer = artifacts.require("CDeployer");
const Collateral = artifacts.require("Collateral");
const Borrowable = artifacts.require("Borrowable");

const oneMantissa = new BN(10).pow(new BN(18));
const oneMilion = new BN(10).pow(new BN(24));

async function setTimestamp(timestamp, contracts = []) {
  for (let x of contracts) {
    await x.setBlockTimestamp(timestamp);
  }
}

function logGas(info, receipt) {
  console.log(info, receipt.receipt.gasUsed);
}

const VESTING_BEGIN = new BN(1700000000);
const VESTING_PERIOD = new BN(100 * 14 * 24 * 3600);
const VESTING_END = VESTING_BEGIN.add(VESTING_PERIOD);

const LIQUIDITY_GENERATION_END = VESTING_BEGIN.sub(new BN(7 * 24 * 3600));
const LIQUIDITY_GENERATION_PERIOD = new BN(7 * 24 * 3600);
const LIQUIDITY_BONUS_PERIOD = new BN(1 * 24 * 3600);
const LIQUIDITY_GENERATION_BEGIN = LIQUIDITY_GENERATION_END.sub(
  LIQUIDITY_GENERATION_PERIOD
);

const TREASURY_AMOUNT = oneMilion.mul(new BN(40));

const PRIVATE_SALE_AMOUNT = oneMilion.mul(new BN(10));

const PERMISSIONLESS_AMOUNT = oneMilion.mul(new BN(13));

const PERMISSIONED_AMOUNT = oneMilion.mul(new BN(2));

const TAROT_AMOUNT = oneMilion.mul(new BN(19));

const AIRDROP_AMOUNT = oneMilion.mul(new BN(10));

const LIQUIDITY_GENERATION_PARTICIPANTS_AMOUNT = oneMilion.mul(new BN(4));
const LIQUIDITY_GENERATION_BONUS_AMOUNT = oneMilion.mul(new BN(1));

// LIQUIDITY
const LIQUIDITY_AMOUNT = oneMilion.mul(new BN(1));

contract("Highlevel", function (accounts) {
  let root = accounts[0];
  let governance = accounts[1];
  let admin = accounts[2];
  let bob = accounts[3];
  let alice = accounts[4];
  let charlie = accounts[5];
  let investorA = accounts[6];
  let investorB = accounts[7];
  let investorC = accounts[8];
  let advisorA = accounts[9];
  let advisorB = accounts[10];
  let advisorC = accounts[11];
  let borrowerA = accounts[12];
  let borrowerB = accounts[13];
  let borrowerC = accounts[14];
  let tarotAdmin = accounts[15];
  let liqA = accounts[16];
  let liqB = accounts[17];
  let liqC = accounts[18];

  let uniswapV2Factory;
  let router;
  let weth;
  let tarotPriceOracle;
  let tarotFactory;
  let ETH;
  let UNI;
  let DAI;
  let ETHUNI;
  let ETHDAI;
  let ETHUNIc;
  let ETHUNIb0;
  let ETHUNIb1;
  let ETHUNIf0;
  let ETHUNIf1;
  let ETHDAIc;
  let ETHDAIb0;
  let ETHDAIb1;
  let ETHDAIf0;
  let ETHDAIf1;

  let tarot;
  let clocks;
  let treasuryVester;
  let treasuryDistributor;
  let privateSaleVester;
  let privateSaleDistributor;
  let permissionlessVester;
  let permissionlessDistributor;
  let permissionedVester;
  let permissionedDistributor;
  let tarotVester;
  let liquidityGenerationParticipantsVester;
  let liquidityGenerationParticipantsDistributor;
  let liquidityGenerationBonusVester;
  let liquidityGenerationBonusDistributor;
  let liquidityGenerator;

  let treasury;
  let farming;
  let farmingPool;

  let pairAddress0;
  let pairAddress1;

  let pair0;
  let pair1;

  before(async () => {
    uniswapV2Factory = await SpookyFactory.new(address(0));
    uniswapV2Factory1 = await SpookyFactory.new(address(0));
    weth = await WETH9.new();
    router = await SpookyRouter.new(uniswapV2Factory.address, weth.address);
    router1 = await SpookyRouter.new(uniswapV2Factory1.address, weth.address);
    tarotPriceOracle = await TarotPriceOracle.new();
    const bDeployer = await BDeployer.new();
    const cDeployer = await CDeployer.new();
    tarotFactory = await Factory.new(
      admin,
      address(0),
      bDeployer.address,
      cDeployer.address,
      tarotPriceOracle.address
    );
    ETH = await MockERC20.new("Ethereum", "ETH");
    UNI = await MockERC20.new("Uniswap", "UNI");
    DAI = await MockERC20.new("DAI", "DAI");

    // token
    tarot = await Tarot.new(root);

    // Create pair0
    pairAddress0 = await uniswapV2Factory.createPair.call(
      weth.address,
      tarot.address
    );
    await uniswapV2Factory.createPair(weth.address, tarot.address);
    pair0 = await UniswapV2Pair.at(pairAddress0);

    // Create pair1
    pairAddress1 = await uniswapV2Factory1.createPair.call(
      weth.address,
      tarot.address
    );
    await uniswapV2Factory1.createPair(weth.address, tarot.address);
    pair1 = await UniswapV2Pair.at(pairAddress1);

    treasuryVester = await VesterStepped.new(
      tarot.address,
      root,
      TREASURY_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    privateSaleVester = await VesterSale.new(
      tarot.address,
      root,
      PRIVATE_SALE_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    permissionlessVester = await Vester.new(
      tarot.address,
      root,
      PERMISSIONLESS_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    permissionedVester = await Vester.new(
      tarot.address,
      root,
      PERMISSIONED_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    tarotVester = await Vester.new(
      tarot.address,
      tarotAdmin,
      TAROT_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    liquidityGenerationParticipantsVester = await VesterSale.new(
      tarot.address,
      root,
      LIQUIDITY_GENERATION_PARTICIPANTS_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    await tarot.transfer(
      liquidityGenerationParticipantsVester.address,
      LIQUIDITY_GENERATION_PARTICIPANTS_AMOUNT
    );
    liquidityGenerationParticipantsDistributor = await OwnedDistributor.new(
      tarot.address,
      liquidityGenerationParticipantsVester.address,
      governance
    );
    await liquidityGenerationParticipantsVester.setRecipient(
      liquidityGenerationParticipantsDistributor.address,
      {
        from: root,
      }
    );
    liquidityGenerationBonusVester = await VesterSale.new(
      tarot.address,
      root,
      LIQUIDITY_GENERATION_BONUS_AMOUNT,
      VESTING_BEGIN,
      VESTING_END
    );
    await tarot.transfer(
      liquidityGenerationBonusVester.address,
      LIQUIDITY_GENERATION_BONUS_AMOUNT
    );
    liquidityGenerationBonusDistributor = await OwnedDistributor.new(
      tarot.address,
      liquidityGenerationBonusVester.address,
      governance
    );
    await liquidityGenerationBonusVester.setRecipient(
      liquidityGenerationBonusDistributor.address,
      {
        from: root,
      }
    );
    liquidityGenerator = await LiquidityGenerator.new(
      governance,
      tarot.address,
      router.address,
      router1.address,
      pair0.address,
      pair1.address,
      governance,
      liquidityGenerationParticipantsDistributor.address,
      liquidityGenerationBonusDistributor.address,
      LIQUIDITY_GENERATION_BEGIN,
      LIQUIDITY_GENERATION_PERIOD,
      LIQUIDITY_BONUS_PERIOD,
      "65",
      "35"
    );
    await tarot.transfer(liquidityGenerator.address, LIQUIDITY_AMOUNT);
    await liquidityGenerationParticipantsDistributor.setAdmin(
      liquidityGenerator.address,
      {
        from: governance,
      }
    );
    await liquidityGenerationBonusDistributor.setAdmin(
      liquidityGenerator.address,
      {
        from: governance,
      }
    );
    clocks = [
      treasuryVester,
      privateSaleVester,
      permissionlessVester,
      permissionedVester,
      tarotVester,
      liquidityGenerationParticipantsVester,
      liquidityGenerator,
    ];

    await expectRevert(
      liquidityGenerator.deposit({
        value: new BN(10).pow(new BN(18)).mul(new BN(50)),
        from: liqA,
      }),
      "LiquidityGenerator: TOO_SOON"
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [
      LIQUIDITY_GENERATION_BEGIN.add(new BN(0)).toNumber(),
    ]);
    console.log("0) liqA balance: ", await web3.eth.getBalance(liqA));
    console.log(
      "0) LiquidityGenerator balance: ",
      await web3.eth.getBalance(liquidityGenerator.address)
    );

    await expectRevert(
      liquidityGenerator.deposit({
        value: 0,
        from: liqA,
      }),
      "LiquidityGenerator: INVALID_VALUE"
    );

    await expectRevert(
      liquidityGenerator.deposit({
        value: new BN(10).pow(new BN(18)).mul(new BN(9)),
        from: liqA,
      }),
      "LiquidityGenerator: INVALID_VALUE"
    );

    const depositRec0 = await liquidityGenerator.deposit({
      value: new BN(10).pow(new BN(18)).mul(new BN(51)),
      from: liqA,
    });
    const depositRec1 = await liquidityGenerator.deposit({
      value: new BN(10).pow(new BN(18)).mul(new BN(50)),
      from: liqA,
    });
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      LIQUIDITY_GENERATION_BEGIN.add(new BN(60 * 60 * 24)).toNumber(),
    ]);

    //await ethers.provider.send("evm_mine");
    const depositRec2 = await liquidityGenerator.deposit({
      value: new BN(10).pow(new BN(18)).mul(new BN(50)),
      from: liqB,
    });
    const depositRec3 = await liquidityGenerator.deposit({
      value: new BN(10).pow(new BN(18)).mul(new BN(50)),
      from: liqB,
    });
    const depositRec4 = await liquidityGenerator.deposit({
      value: new BN(10).pow(new BN(18)).mul(new BN(53)),
      from: liqA,
    });
    const depositRec5 = await liquidityGenerator.deposit({
      value: new BN(10).pow(new BN(18)).mul(new BN(50)),
      from: liqA,
    });
    console.log("1) liqA balance: ", await web3.eth.getBalance(liqA));
    console.log(
      "1) LiquidityGenerator balance: ",
      await web3.eth.getBalance(liquidityGenerator.address)
    );
    const sharesA = (
      await liquidityGenerator.distributorRecipients(liqA)
    ).shares.toString();
    const sharesB = (
      await liquidityGenerator.distributorRecipients(liqB)
    ).shares.toString();
    const sharesC = (
      await liquidityGenerator.distributorRecipients(liqC)
    ).shares.toString();
    console.log("Shares", { sharesA, sharesB, sharesC });
    const sharesBonusA = (
      await liquidityGenerator.bonusDistributorRecipients(liqA)
    ).shares.toString();
    const sharesBonusB = (
      await liquidityGenerator.bonusDistributorRecipients(liqB)
    ).shares.toString();
    const sharesBonusC = (
      await liquidityGenerator.bonusDistributorRecipients(liqC)
    ).shares.toString();
    console.log("SharesBonus", { sharesBonusA, sharesBonusB, sharesBonusC });
    const distributorTotalShares = (
      await liquidityGenerator.distributorTotalShares()
    ).toString();
    const bonusDistributorTotalShares = (
      await liquidityGenerator.bonusDistributorTotalShares()
    ).toString();
    console.log("TotalShares", {
      distributorTotalShares,
      bonusDistributorTotalShares,
    });

    await expectRevert(
      liquidityGenerator.finalize({
        from: liqA,
      }),
      "LiquidityGenerator: UNAUTHORIZED"
    );

    await expectRevert(
      liquidityGenerator.deliverLiquidityToReservesManager({
        from: governance,
      }),
      "LiquidityGenerator: NOT_FINALIZED"
    );

    await expectRevert(
      liquidityGenerator.finalize({
        from: governance,
      }),
      "LiquidityGenerator: TOO_SOON"
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [
      LIQUIDITY_GENERATION_END.add(new BN(0)).toNumber(),
    ]);

    await expectRevert(
      liquidityGenerator.deposit({
        value: new BN(10).pow(new BN(18)).mul(new BN(50)),
        from: liqA,
      }),
      "LiquidityGenerator: TOO_LATE"
    );

    //    await ethers.provider.send("evm_mine");
    await liquidityGenerator.finalize({
      from: governance,
    });

    await expectRevert(
      liquidityGenerator.finalize({
        from: governance,
      }),
      "LiquidityGenerator: FINALIZED"
    );
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.sub(new BN(10000)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
  });

  it("initialize treasury", async () => {
    await tarot.transfer(treasuryVester.address, TREASURY_AMOUNT);
    treasuryDistributor = await OwnedDistributor.new(
      tarot.address,
      treasuryVester.address,
      governance
    );
    await treasuryVester.setRecipient(treasuryDistributor.address, {
      from: root,
    });
  });

  it("initialize private sale", async () => {
    await tarot.transfer(privateSaleVester.address, PRIVATE_SALE_AMOUNT);
    privateSaleDistributor = await InitializedDistributor.new(
      tarot.address,
      privateSaleVester.address,
      [
        encode(["address", "uint256"], [investorA, "3500"]),
        encode(["address", "uint256"], [investorB, "2500"]),
        encode(["address", "uint256"], [investorC, "4000"]),
      ]
    );
    privateSaleVester.setRecipient(privateSaleDistributor.address, {
      from: root,
    });
  });

  it("initialize core contributors", async () => {
    await tarot.transfer(permissionlessVester.address, PERMISSIONLESS_AMOUNT);
    permissionlessDistributor = await InitializedDistributor.new(
      tarot.address,
      permissionlessVester.address,
      [
        encode(["address", "uint256"], [bob, "8000"]),
        encode(["address", "uint256"], [alice, "4000"]),
        encode(["address", "uint256"], [charlie, "1000"]),
      ]
    );
    permissionlessVester.setRecipient(permissionlessDistributor.address, {
      from: root,
    });
  });

  it("initialize advisors", async () => {
    await tarot.transfer(permissionedVester.address, PERMISSIONED_AMOUNT);
    permissionedDistributor = await OwnedDistributor.new(
      tarot.address,
      permissionedVester.address,
      admin
    );
    const setRecipientRec = await permissionedVester.setRecipient(
      permissionedDistributor.address,
      { from: root }
    );
    const editRecipientRecA = await permissionedDistributor.editRecipient(
      advisorA,
      "5000",
      { from: admin }
    );
    const editRecipientRecB = await permissionedDistributor.editRecipient(
      advisorB,
      "3000",
      { from: admin }
    );
    await permissionedDistributor.editRecipient(advisorC, "2000", {
      from: admin,
    });
    logGas("Permissioned Vester set recipient", setRecipientRec);
    logGas("Permissioned Distributor edit first recipient", editRecipientRecA);
    logGas("Permissioned Distributor edit second recipient", editRecipientRecB);
  });

  it("initialize tarot", async () => {
    await tarot.transfer(tarotVester.address, TAROT_AMOUNT);
  });

  it("setup ETHUNI", async () => {
    // Create pair
    const ETHUNIAddress = await uniswapV2Factory.createPair.call(
      ETH.address,
      UNI.address
    );
    await uniswapV2Factory.createPair(ETH.address, UNI.address);
    ETHUNI = await UniswapV2Pair.at(ETHUNIAddress);
    await UNI.mint(ETHUNIAddress, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHUNIAddress, oneMantissa.mul(new BN(1000000)));
    await ETHUNI.mint(root);
    const collateralAddress = await tarotFactory.createCollateral.call(
      ETHUNIAddress
    );
    const borrowable0Address = await tarotFactory.createBorrowable0.call(
      ETHUNIAddress
    );
    const borrowable1Address = await tarotFactory.createBorrowable1.call(
      ETHUNIAddress
    );
    await tarotFactory.createCollateral(ETHUNIAddress);
    await tarotFactory.createBorrowable0(ETHUNIAddress);
    await tarotFactory.createBorrowable1(ETHUNIAddress);
    await tarotFactory.initializeLendingPool(ETHUNIAddress);
    ETHUNIc = await Collateral.at(collateralAddress);
    ETHUNIb0 = await Borrowable.at(borrowable0Address);
    ETHUNIb1 = await Borrowable.at(borrowable1Address);
    await increaseTime(1300); // wait for oracle to be ready
    // Enable liquidity mining
    ETHUNIfp0 = await FarmingPool.new(
      tarot.address,
      treasuryDistributor.address,
      ETHUNIb0.address,
      treasuryVester.address
    );
    ETHUNIfp1 = await FarmingPool.new(
      tarot.address,
      treasuryDistributor.address,
      ETHUNIb1.address,
      treasuryVester.address
    );
    clocks.push(ETHUNIfp0);
    clocks.push(ETHUNIfp1);
    await treasuryDistributor.editRecipient(ETHUNIfp0.address, "350", {
      from: governance,
    });
    await treasuryDistributor.editRecipient(ETHUNIfp1.address, "350", {
      from: governance,
    });
    const setBorrowTrackerRec = await ETHUNIb0._setBorrowTracker(
      ETHUNIfp0.address,
      { from: admin }
    );
    logGas("Set borrow tracker", setBorrowTrackerRec);
    await ETHUNIb1._setBorrowTracker(ETHUNIfp1.address, { from: admin });
    // Supply liquidity and collateral
    await UNI.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
    await UNI.mint(ETHUNIb1.address, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHUNIb1.address, oneMantissa.mul(new BN(1000000)));
    await ETHUNIb0.mint(root);
    await ETHUNIb1.mint(root);
    await ETHUNI.transfer(ETHUNIc.address, oneMantissa.mul(new BN(100000)));
    await ETHUNIc.mint(borrowerA);
    await ETHUNI.transfer(ETHUNIc.address, oneMantissa.mul(new BN(100000)));
    await ETHUNIc.mint(borrowerB);
    await ETHUNI.transfer(ETHUNIc.address, oneMantissa.mul(new BN(100000)));
    await ETHUNIc.mint(borrowerC);
  });

  it("borrow ETHUNI ", async () => {
    const borrowFirstRec = await ETHUNIb0.borrow(
      borrowerA,
      borrowerA,
      oneMantissa.mul(new BN(2)),
      "0x",
      { from: borrowerA }
    );
    const borrowSecondRec = await ETHUNIb0.borrow(
      borrowerB,
      borrowerB,
      oneMantissa.mul(new BN(1)),
      "0x",
      { from: borrowerB }
    );
    logGas("Borrow first with tracking", borrowFirstRec);
    logGas("Borrow second with tracking", borrowSecondRec);
    await ETHUNIb1.borrow(
      borrowerA,
      borrowerA,
      oneMantissa.mul(new BN(2)),
      "0x",
      { from: borrowerA }
    );
  });

  it("30% 1st epoch", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 3) / 10)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    //await setTimestamp(
    // VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 3) / 10)),
    // clocks
    //);
    const privateSaleClaimRec = await privateSaleDistributor.claim({
      from: investorA,
    });
    await permissionlessDistributor.claim({ from: bob });
    await permissionedDistributor.claim({ from: advisorA });
    const tarotVesterClaimRec = await tarotVester.claim({ from: tarotAdmin });
    const farmingPoolClaimFirstRec = await ETHUNIfp0.claim({ from: borrowerA });
    const farmingPoolClaimSecondRec = await ETHUNIfp0.claimAccount(borrowerB);
    const advanceRec = await ETHUNIfp1.advance();
    const borrowThirdRec = await ETHUNIb0.borrow(
      borrowerC,
      borrowerC,
      oneMantissa.mul(new BN(1)),
      "0x",
      { from: borrowerC }
    );
    await ETHUNIb1.borrow(
      borrowerB,
      borrowerB,
      oneMantissa.mul(new BN(1)),
      "0x",
      { from: borrowerB }
    );
    logGas("Private sale claim", privateSaleClaimRec);
    logGas("Tarot vester claim", tarotVesterClaimRec);
    logGas("Farming pool first claim and advance", farmingPoolClaimFirstRec);
    logGas("Farming pool second claim", farmingPoolClaimSecondRec);
    logGas("Advance", advanceRec);
    logGas("Borrow third with tracking", borrowThirdRec);
    expectAlmostEqualMantissa(
      await tarot.balanceOf(investorA),
      PRIVATE_SALE_AMOUNT.mul(new BN((0.2 + 0.021055 * 0.3) * 0.35 * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(bob),
      oneMilion.mul(new BN(8 * 0.026319 * 0.3 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(advisorA),
      PERMISSIONED_AMOUNT.mul(new BN(0.5 * 0.026319 * 0.3 * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(tarotAdmin),
      TAROT_AMOUNT.mul(new BN(0.026319 * 0.3 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(borrowerA),
      TREASURY_AMOUNT.mul(new BN((0.026319 / 3) * 0.3 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(borrowerB),
      TREASURY_AMOUNT.mul(new BN((0.026319 / 2 / 3) * 0.3 * 1e9)).div(
        new BN(1e9)
      )
    );
  });

  it("60% 1st epoch", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 6) / 10)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    // await setTimestamp(
    //  VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 6) / 10)),
    //  clocks
    //);
    // Repay
    await UNI.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHUNIb0.address, oneMantissa.mul(new BN(1000000)));
    await ETHUNIb0.borrow(borrowerC, borrowerC, "0", "0x", { from: borrowerC });
  });

  it("20% 2nd epoch", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 12) / 10)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    // await setTimestamp(
    //   VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 12) / 10)),
    //   clocks
    // );
    await ETHUNIfp0.advance();
    await ETHUNIfp1.advance();
    await ETHUNIb1.borrow(
      borrowerC,
      borrowerC,
      oneMantissa.mul(new BN(1)),
      "0x",
      { from: borrowerC }
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp0.claim.call({ from: borrowerA }),
      TREASURY_AMOUNT.mul(
        new BN(
          (((0.026319 * 0.3) / 2 +
            ((0.026319 * 0.4 + 0.025687 * 0.2) * 2) / 3) /
            2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp0.claim.call({ from: borrowerB }),
      TREASURY_AMOUNT.mul(
        new BN(
          (((0.026319 * 0.3) / 4 + (0.026319 * 0.4 + 0.025687 * 0.2) / 3) / 2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp0.claim.call({ from: borrowerC }),
      TREASURY_AMOUNT.mul(new BN(((0.026319 * 0.3) / 4 / 2) * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp1.claim.call({ from: borrowerA }),
      TREASURY_AMOUNT.mul(
        new BN(
          ((0.026319 * 0.3 + ((0.026319 * 0.7 + 0.025687 * 0.2) * 2) / 3) / 2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp1.claim.call({ from: borrowerB }),
      TREASURY_AMOUNT.mul(
        new BN(((0.026319 * 0.7 + 0.025687 * 0.2) / 3 / 2) * 1e9)
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp1.claim.call({ from: borrowerC }),
      0
    );
  });

  it("setup ETHDAI", async () => {
    // Create pair
    const ETHDAIAddress = await uniswapV2Factory.createPair.call(
      ETH.address,
      DAI.address
    );
    await uniswapV2Factory.createPair(ETH.address, DAI.address);
    ETHDAI = await UniswapV2Pair.at(ETHDAIAddress);
    await DAI.mint(ETHDAIAddress, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHDAIAddress, oneMantissa.mul(new BN(1000000)));
    await ETHDAI.mint(root);
    const collateralAddress = await tarotFactory.createCollateral.call(
      ETHDAIAddress
    );
    const borrowable0Address = await tarotFactory.createBorrowable0.call(
      ETHDAIAddress
    );
    const borrowable1Address = await tarotFactory.createBorrowable1.call(
      ETHDAIAddress
    );
    await tarotFactory.createCollateral(ETHDAIAddress);
    await tarotFactory.createBorrowable0(ETHDAIAddress);
    await tarotFactory.createBorrowable1(ETHDAIAddress);
    await tarotFactory.initializeLendingPool(ETHDAIAddress);
    ETHDAIc = await Collateral.at(collateralAddress);
    ETHDAIb0 = await Borrowable.at(borrowable0Address);
    ETHDAIb1 = await Borrowable.at(borrowable1Address);
    await increaseTime(1300); // wait for oracle to be ready
    // Supply liquidity and collateral
    await DAI.mint(ETHDAIb0.address, oneMantissa.mul(new BN(1000000)));
    await DAI.mint(ETHDAIb1.address, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHDAIb0.address, oneMantissa.mul(new BN(1000000)));
    await ETH.mint(ETHDAIb1.address, oneMantissa.mul(new BN(1000000)));
    await ETHDAIb0.mint(root);
    await ETHDAIb1.mint(root);
    await ETHDAI.transfer(ETHDAIc.address, oneMantissa.mul(new BN(100000)));
    await ETHDAIc.mint(borrowerA);
    await ETHDAI.transfer(ETHDAIc.address, oneMantissa.mul(new BN(100000)));
    await ETHDAIc.mint(borrowerB);
    await ETHDAI.transfer(ETHDAIc.address, oneMantissa.mul(new BN(100000)));
    await ETHDAIc.mint(borrowerC);
  });

  it("borrow ETHDAI", async () => {
    const borrowFirstRec = await ETHDAIb0.borrow(
      borrowerA,
      borrowerA,
      oneMantissa.mul(new BN(2)),
      "0x",
      { from: borrowerA }
    );
    const borrowSecondRec = await ETHDAIb0.borrow(
      borrowerB,
      borrowerB,
      oneMantissa.mul(new BN(1)),
      "0x",
      { from: borrowerB }
    );
    await ETHDAIb1.borrow(
      borrowerA,
      borrowerA,
      oneMantissa.mul(new BN(2)),
      "0x",
      { from: borrowerA }
    );
    logGas("Borrow first without tracking", borrowFirstRec);
    logGas("Borrow second without tracking", borrowSecondRec);
  });

  it("50% 3rd epoch", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 25) / 10)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    //await setTimestamp(
    //  VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 25) / 10)),
    //  clocks
    //);
    await ETHUNIfp0.advance();
    await ETHUNIfp1.advance();
  });

  it("add liquidity mining to ETHDAI", async () => {
    // Enable liquidity mining
    ETHDAIfp0 = await FarmingPool.new(
      tarot.address,
      treasuryDistributor.address,
      ETHDAIb0.address,
      treasuryVester.address
    );
    ETHDAIfp1 = await FarmingPool.new(
      tarot.address,
      treasuryDistributor.address,
      ETHDAIb1.address,
      treasuryVester.address
    );
    clocks.push(ETHDAIfp0);
    clocks.push(ETHDAIfp1);
    await treasuryDistributor.editRecipient(ETHDAIfp0.address, "150", {
      from: governance,
    });
    await treasuryDistributor.editRecipient(ETHDAIfp1.address, "150", {
      from: governance,
    });
    await ETHDAIb0._setBorrowTracker(ETHDAIfp0.address, { from: admin });
    await ETHDAIb1._setBorrowTracker(ETHDAIfp1.address, { from: admin });
    const trackBorrowFirstRec = await ETHDAIb0.trackBorrow(borrowerA);
    const trackBorrowSecondRec = await ETHDAIb0.trackBorrow(borrowerB);
    await ETHDAIb1.trackBorrow(borrowerA);
    logGas("Trackborrow first", trackBorrowFirstRec);
    logGas("Trackborrow second", trackBorrowSecondRec);
  });

  it("50% 4th epoch", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 35) / 10)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    //await setTimestamp(
    //  VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 35) / 10)),
    //  clocks
    //);
    await ETHUNIfp0.advance();
    await ETHUNIfp1.advance();
    await ETHDAIfp0.advance();
    await ETHDAIfp1.advance();
    await ETHDAIb0.borrow(
      borrowerC,
      borrowerC,
      oneMantissa.mul(new BN(1)),
      "0x",
      { from: borrowerC }
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp0.claim.call({ from: borrowerA }),
      TREASURY_AMOUNT.mul(
        new BN(
          (((0.026319 * 0.3) / 2 +
            ((0.026319 * 0.4 + 0.025687 + 0.025071 + 0.024469 * 0.5 * 0.7) *
              2) /
              3) /
            2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp0.claim.call({ from: borrowerB }),
      TREASURY_AMOUNT.mul(
        new BN(
          (((0.026319 * 0.3) / 4 +
            (0.026319 * 0.4 + 0.025687 + 0.025071 + 0.024469 * 0.5 * 0.7) / 3) /
            2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp0.claim.call({ from: borrowerC }),
      TREASURY_AMOUNT.mul(new BN(((0.026319 * 0.3) / 4 / 2) * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp1.claim.call({ from: borrowerA }),
      TREASURY_AMOUNT.mul(
        new BN(
          ((0.026319 * 0.3 +
            ((0.026319 * 0.7 + 0.025687 * 0.2) * 2) / 3 +
            (0.025687 * 0.8 + 0.025071 + 0.024469 * 0.5 * 0.7) / 2) /
            2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHUNIfp1.claim.call({ from: borrowerB }),
      TREASURY_AMOUNT.mul(
        new BN(
          (((0.026319 * 0.7 + 0.025687 * 0.2) / 3 +
            (0.025687 * 0.8 + 0.025071 + 0.024469 * 0.5 * 0.7) / 4) /
            2) *
            1e9
        )
      ).div(new BN(1e9))
    );
    0.0344267;
    expectAlmostEqualMantissa(
      await ETHUNIfp1.claim.call({ from: borrowerC }),
      TREASURY_AMOUNT.mul(
        new BN(
          ((0.025687 * 0.8 + 0.025071 + 0.024469 * 0.5 * 0.7) / 4 / 2) * 1e9
        )
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHDAIfp0.claim.call({ from: borrowerA }),
      TREASURY_AMOUNT.mul(
        new BN(((0.024469 * 0.5 * 0.3 * 2) / 3 / 2) * 1e9)
      ).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await ETHDAIfp0.claim.call({ from: borrowerB }),
      TREASURY_AMOUNT.mul(new BN(((0.024469 * 0.5 * 0.3) / 3 / 2) * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await ETHDAIfp0.claim.call({ from: borrowerC }),
      0
    );
    expectAlmostEqualMantissa(
      await ETHDAIfp1.claim.call({ from: borrowerA }),
      TREASURY_AMOUNT.mul(new BN(((0.024469 * 0.5 * 0.3 * 1) / 2) * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await ETHDAIfp1.claim.call({ from: borrowerB }),
      0
    );
    expectAlmostEqualMantissa(
      await ETHDAIfp1.claim.call({ from: borrowerC }),
      0
    );
  });

  it("remove advisor", async () => {
    await permissionedDistributor.editRecipient(advisorC, "0", { from: admin });
    await permissionedDistributor.editRecipient(admin, "2000", { from: admin });
  });

  it("50% 5th epoch", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 45) / 10)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    //await setTimestamp(
    //  VESTING_BEGIN.add(new BN((14 * 24 * 3600 * 45) / 10)),
    //  clocks
    //);
    await ETHUNIfp0.advance();
    await ETHUNIfp1.advance();
    await ETHDAIfp0.advance();
    await ETHDAIfp1.advance();
    await ETHUNIfp0.claim({ from: borrowerA });
    await ETHUNIfp0.claim({ from: borrowerB });
    await ETHUNIfp0.claim({ from: borrowerC });
    await ETHUNIfp1.claim({ from: borrowerA });
    await ETHUNIfp1.claim({ from: borrowerB });
    await ETHUNIfp1.claim({ from: borrowerC });
    await ETHDAIfp0.claim({ from: borrowerA });
    await ETHDAIfp0.claim({ from: borrowerB });
    await ETHDAIfp0.claim({ from: borrowerC });
    await ETHDAIfp1.claim({ from: borrowerA });
    await ETHDAIfp1.claim({ from: borrowerB });
    await ETHDAIfp1.claim({ from: borrowerC });
    await privateSaleDistributor.claim({ from: investorA });
    await permissionlessDistributor.claim({ from: bob });
    await permissionedDistributor.claim({ from: advisorA });
    await permissionedDistributor.claim({ from: advisorC });
    await tarotVester.claim({ from: tarotAdmin });
    expectAlmostEqualMantissa(
      await tarot.balanceOf(investorA),
      PRIVATE_SALE_AMOUNT.mul(new BN((0.2 + 0.113487 * 0.8) * 0.35 * 1e9)).div(
        new BN(1e9)
      )
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(bob),
      oneMilion.mul(new BN(8 * 0.113487 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(advisorA),
      PERMISSIONED_AMOUNT.mul(new BN(0.5 * 0.113487 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(advisorC),
      PERMISSIONED_AMOUNT.mul(new BN(0.2 * 0.089311 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(tarotAdmin),
      TAROT_AMOUNT.mul(new BN(0.113487 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(borrowerA),
      TREASURY_AMOUNT.mul(new BN(0.071605 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(borrowerB),
      TREASURY_AMOUNT.mul(new BN(0.031099 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(borrowerC),
      TREASURY_AMOUNT.mul(new BN(0.010782 * 1e9)).div(new BN(1e9))
    );
  });

  it("unlock and deliver liquidity to reserves manager", async () => {
    console.log(
      "LiquidityGenerator pair0 balance: ",
      (await pair0.balanceOf(liquidityGenerator.address)).toString()
    );
    console.log(
      "LiquidityGenerator pair1 balance: ",
      (await pair1.balanceOf(liquidityGenerator.address)).toString()
    );
    console.log(
      "reservesManager pair0 balance: ",
      (
        await pair0.balanceOf(await liquidityGenerator.reservesManager())
      ).toString()
    );
    console.log(
      "reservesManager pair1 balance: ",
      (
        await pair1.balanceOf(await liquidityGenerator.reservesManager())
      ).toString()
    );

    await expectRevert(
      liquidityGenerator.deliverLiquidityToReservesManager({
        from: liqA,
      }),
      "LiquidityGenerator: UNAUTHORIZED"
    );

    await expectRevert(
      liquidityGenerator.deliverLiquidityToReservesManager({
        from: governance,
      }),
      "LiquidityGenerator: STILL_LOCKED"
    );

    console.log(
      "Unlock timestamp: ",
      (await liquidityGenerator.unlockTimestamp()).toString()
    );

    await expectRevert(
      liquidityGenerator.postponeUnlockTimestamp(
        (
          await liquidityGenerator.unlockTimestamp()
        ).add(new BN(60 * 60 * 24 * 30)),
        {
          from: liqA,
        }
      ),
      "LiquidityGenerator: UNAUTHORIZED"
    );

    await expectRevert(
      liquidityGenerator.postponeUnlockTimestamp(
        await liquidityGenerator.unlockTimestamp(),
        {
          from: governance,
        }
      ),
      "LiquidityGenerator: INVALID_UNLOCK_TIMESTAMP"
    );

    await liquidityGenerator.postponeUnlockTimestamp(
      (
        await liquidityGenerator.unlockTimestamp()
      ).add(new BN(60 * 60 * 24 * 30)),
      {
        from: governance,
      }
    );
    console.log(
      "Postponed unlock timestamp: ",
      (await liquidityGenerator.unlockTimestamp()).toString()
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [
      (await liquidityGenerator.unlockTimestamp()).toNumber(),
    ]);

    console.log("Delivered: ", await liquidityGenerator.delivered());

    await liquidityGenerator.deliverLiquidityToReservesManager({
      from: governance,
    });

    console.log("Delivered: ", await liquidityGenerator.delivered());

    console.log(
      "LiquidityGenerator pair0 balance: ",
      (await pair0.balanceOf(liquidityGenerator.address)).toString()
    );
    console.log(
      "LiquidityGenerator pair1 balance: ",
      (await pair1.balanceOf(liquidityGenerator.address)).toString()
    );
    console.log(
      "reservesManager pair0 balance: ",
      (
        await pair0.balanceOf(await liquidityGenerator.reservesManager())
      ).toString()
    );
    console.log(
      "reservesManager pair1 balance: ",
      (
        await pair1.balanceOf(await liquidityGenerator.reservesManager())
      ).toString()
    );
  });

  it("after vestingEnd", async () => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_END.add(new BN(1)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    // await setTimestamp(VESTING_END.add(new BN(1)), clocks);
    const advanceRec = await ETHUNIfp0.advance();
    await ETHUNIfp1.advance();
    await ETHDAIfp0.advance();
    await ETHDAIfp1.advance();
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      VESTING_END.add(VESTING_PERIOD).add(new BN(1)).toNumber(),
    ]);
    await ethers.provider.send("evm_mine");
    // await setTimestamp(VESTING_END.add(VESTING_PERIOD).add(new BN(1)), clocks);
    const distributorClaimFirstRec = await privateSaleDistributor.claim({
      from: investorA,
    });
    console.log(
      "liqA tarot balance: ",
      (await tarot.balanceOf(liqA)).toString()
    );
    console.log(
      "liqB tarot balance: ",
      (await tarot.balanceOf(liqB)).toString()
    );
    console.log(
      "liqC tarot balance: ",
      (await tarot.balanceOf(liqC)).toString()
    );
    await liquidityGenerationParticipantsDistributor.claim({ from: liqA });
    await liquidityGenerationParticipantsDistributor.claim({ from: liqB });
    await liquidityGenerationParticipantsDistributor.claim({ from: liqC });
    console.log(
      "liqA tarot balance: ",
      (await tarot.balanceOf(liqA)).toString()
    );
    console.log(
      "liqB tarot balance: ",
      (await tarot.balanceOf(liqB)).toString()
    );
    console.log(
      "liqC tarot balance: ",
      (await tarot.balanceOf(liqC)).toString()
    );
    await liquidityGenerationBonusDistributor.claim({ from: liqA });
    await liquidityGenerationBonusDistributor.claim({ from: liqB });
    await liquidityGenerationBonusDistributor.claim({ from: liqC });
    console.log(
      "liqA tarot balance: ",
      (await tarot.balanceOf(liqA)).toString()
    );
    console.log(
      "liqB tarot balance: ",
      (await tarot.balanceOf(liqB)).toString()
    );
    console.log(
      "liqC tarot balance: ",
      (await tarot.balanceOf(liqC)).toString()
    );
    await privateSaleDistributor.claim({ from: investorB });
    await privateSaleDistributor.claim({ from: investorC });
    await permissionlessDistributor.claim({ from: bob });
    await permissionlessDistributor.claim({ from: alice });
    await permissionlessDistributor.claim({ from: charlie });
    await permissionedDistributor.claim({ from: advisorA });
    await permissionedDistributor.claim({ from: advisorB });
    await permissionedDistributor.claim({ from: advisorC });
    await permissionedDistributor.claim({ from: admin });
    await tarotVester.claim({ from: tarotAdmin });
    const farmingPoolClaimFirstRec = await ETHUNIfp0.claim({ from: borrowerA });
    const farmingPoolClaimSecondRec = await ETHUNIfp0.claim({
      from: borrowerB,
    });
    await ETHUNIfp0.claim({ from: borrowerC });
    await ETHUNIfp1.claim({ from: borrowerA });
    await ETHUNIfp1.claim({ from: borrowerB });
    await ETHUNIfp1.claim({ from: borrowerC });
    await ETHDAIfp0.claim({ from: borrowerA });
    await ETHDAIfp0.claim({ from: borrowerB });
    await ETHDAIfp0.claim({ from: borrowerC });
    await ETHDAIfp1.claim({ from: borrowerA });
    await ETHDAIfp1.claim({ from: borrowerB });
    await ETHDAIfp1.claim({ from: borrowerC });
    logGas("Advance", advanceRec);
    logGas("Farming pool first claim", farmingPoolClaimFirstRec);
    logGas("Farming pool second claim", farmingPoolClaimSecondRec);
    logGas("Distributor first claim", distributorClaimFirstRec);
    expectAlmostEqualMantissa(
      await tarot.balanceOf(investorA),
      PRIVATE_SALE_AMOUNT.mul(new BN(7)).div(new BN(20))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(investorB),
      PRIVATE_SALE_AMOUNT.mul(new BN(5)).div(new BN(20))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(investorC),
      PRIVATE_SALE_AMOUNT.mul(new BN(8)).div(new BN(20))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(bob),
      oneMilion.mul(new BN(8))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(alice),
      oneMilion.mul(new BN(4))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(charlie),
      oneMilion.mul(new BN(1))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(advisorA),
      PERMISSIONED_AMOUNT.mul(new BN(5)).div(new BN(10))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(advisorB),
      PERMISSIONED_AMOUNT.mul(new BN(3)).div(new BN(10))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(advisorC),
      PERMISSIONED_AMOUNT.mul(new BN(0.017862 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(admin),
      PERMISSIONED_AMOUNT.mul(new BN(0.182138 * 1e9)).div(new BN(1e9))
    );
    expectAlmostEqualMantissa(await tarot.balanceOf(tarotAdmin), TAROT_AMOUNT);
    expectAlmostEqualMantissa(await tarot.balanceOf(treasuryVester.address), 0);
    expectAlmostEqualMantissa(
      await tarot.balanceOf(privateSaleVester.address),
      0
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(permissionlessVester.address),
      0
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(permissionedVester.address),
      0
    );
    expectAlmostEqualMantissa(await tarot.balanceOf(tarotVester.address), 0);
    expectAlmostEqualMantissa(
      await tarot.balanceOf(treasuryDistributor.address),
      0
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(privateSaleDistributor.address),
      0
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(permissionlessDistributor.address),
      0
    );
    expectAlmostEqualMantissa(
      await tarot.balanceOf(permissionedDistributor.address),
      0
    );
    expectAlmostEqualMantissa(await tarot.balanceOf(ETHUNIfp0.address), 0);
    expectAlmostEqualMantissa(await tarot.balanceOf(ETHUNIfp1.address), 0);
    expectAlmostEqualMantissa(await tarot.balanceOf(ETHDAIfp0.address), 0);
    expectAlmostEqualMantissa(await tarot.balanceOf(ETHDAIfp1.address), 0);
  });
});
