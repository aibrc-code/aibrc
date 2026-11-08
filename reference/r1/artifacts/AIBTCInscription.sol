// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {TEXT, TEXT_SHA256} from "InscriptionText.sol";

/// @notice Immutable pure reference; executors, not this contract, move or lock assets.
contract AIBTCInscription {
    uint256 public constant VERSION = 1;
    uint256 public constant PLATFORM_FEE_BPS = 50;
    uint256 public constant MIN_USER_GROSS_SATS = 1000;
    uint256 public constant BUYBACK_TRIGGER_SATS = 1000;
    bytes32 public constant INSCRIPTION_TEXT_SHA256 = TEXT_SHA256;

    error InvalidBasisPoints();
    error InvalidTax();
    error InvalidBuy();
    error InvalidDestination();
    error MinimumGross();
    error CapabilityOutOfBounds();

    function inscriptionText() external pure returns (string memory) { return TEXT; }

    function _validTax(uint256 T) internal pure returns (bool) {
        return T <= 500 && T % 10 == 0;
    }

    function isValidRule(uint256 T, uint256 C) external pure returns (bool) {
        return _validTax(T) && (C == 0 || C == 10000) && (T != 0 || C == 0);
    }

    function ceilBps(uint256 amount, uint256 bps) public pure returns (uint256) {
        if (bps > 10000) revert InvalidBasisPoints();
        uint256 remainderProduct = (amount % 10000) * bps;
        return (amount / 10000) * bps + remainderProduct / 10000 + (remainderProduct % 10000 == 0 ? 0 : 1);
    }

    function _fees(uint256 base, uint256 T, bool postAtTradeStart) internal pure
        returns (uint256 platformFee, uint256 ruleFee, uint256 totalFee)
    {
        if (!_validTax(T)) revert InvalidTax();
        platformFee = ceilBps(base, 50);
        totalFee = ceilBps(base, 50 + (postAtTradeStart ? T : 0));
        ruleFee = totalFee - platformFee;
    }

    function quoteUserBuy(uint256 requestedTotal, uint256 executedTotal, uint256 T, bool postAtTradeStart)
        external pure returns (uint256 platformFee, uint256 ruleFee, uint256 totalFee, uint256 principal, uint256 totalDebit)
    {
        if (requestedTotal < 1000) revert MinimumGross();
        if (executedTotal == 0 || executedTotal > requestedTotal || (postAtTradeStart && executedTotal != requestedTotal)) revert InvalidBuy();
        (platformFee, ruleFee, totalFee) = _fees(executedTotal, T, postAtTradeStart);
        principal = executedTotal - totalFee;
        if (principal == 0) revert InvalidBuy();
        totalDebit = executedTotal;
    }

    function quoteUserSell(uint256 G, uint256 T, bool postAtTradeStart)
        external pure returns (uint256 platformFee, uint256 ruleFee, uint256 totalFee, uint256 net)
    {
        if (G < 1000) revert MinimumGross();
        (platformFee, ruleFee, totalFee) = _fees(G, T, postAtTradeStart);
        net = G - totalFee;
    }

    function routeRuleFee(uint256 ruleFee, uint256 C)
        external pure returns (uint256 creatorAmount, uint256 buybackAmount)
    {
        if (C != 0 && C != 10000) revert InvalidDestination();
        return C == 10000 ? (ruleFee, uint256(0)) : (uint256(0), ruleFee);
    }

    function planBuyback(uint256 V, uint256 N) external pure
        returns (bool shouldExecute, uint256 spend, uint256 nextSequence, uint256 platformFee, uint256 ruleFee)
    {
        if (V < 1000) return (false, 0, 0, 0, 0);
        return (true, V, N + 1, 0, 0);
    }

    function reservedCapabilityCount() external pure returns (uint256) { return 15; }

    function reservedCapabilityAt(uint256 index) external pure returns (string memory id, string memory title, string memory status) {
        status = "RESERVED_DOCUMENTATION_ONLY";
        if (index == 0) return ("X402", "x402 payments", status);
        if (index == 1) return ("AGENT", "AI Agent", status);
        if (index == 2) return ("LLM", "language-model integration", status);
        if (index == 3) return ("DAO", "governance", status);
        if (index == 4) return ("STOCK", "stocks/RWA", status);
        if (index == 5) return ("EXTERNAL_RECEIPT", "external receipts", status);
        if (index == 6) return ("EXTERNAL_WALLET_CLAIM", "external wallet claims", status);
        if (index == 7) return ("CERTIFIED_EXTERNAL_CONTRACT", "certified external contracts", status);
        if (index == 8) return ("DIVIDEND", "dividends", status);
        if (index == 9) return ("AUTO_LP", "automatic liquidity", status);
        if (index == 10) return ("AIRDROP", "airdrops", status);
        if (index == 11) return ("MISSION", "mission vault", status);
        if (index == 12) return ("ORBIT", "satellite tokens", status);
        if (index == 13) return ("BRIDGE", "bridges", status);
        if (index == 14) return ("ORACLE", "oracles", status);
        revert CapabilityOutOfBounds();
    }
}
