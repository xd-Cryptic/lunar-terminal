"""Comprehensive ticker universe for the Lunar Terminal.

Provides hardcoded symbol lists for stocks (S&P 500 subset), crypto, and forex
markets.  Each entry carries a human-readable name, sector (or category), and
market type so the frontend can filter, search, and group without hitting any
external API.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger("terminal.universe")


class TickerUniverse:
    """Searchable, filterable ticker database covering stocks, crypto, and forex."""

    # ── S&P 500 subset — at least 100 major stocks across all 11 GICS sectors ──

    _STOCKS: list[dict] = [
        # ── Technology ───────────────────────────────────────────────
        {"symbol": "AAPL",  "name": "Apple Inc.",                       "sector": "Technology"},
        {"symbol": "MSFT",  "name": "Microsoft Corporation",            "sector": "Technology"},
        {"symbol": "NVDA",  "name": "NVIDIA Corporation",               "sector": "Technology"},
        {"symbol": "GOOGL", "name": "Alphabet Inc. (Class A)",          "sector": "Technology"},
        {"symbol": "GOOG",  "name": "Alphabet Inc. (Class C)",          "sector": "Technology"},
        {"symbol": "META",  "name": "Meta Platforms Inc.",               "sector": "Technology"},
        {"symbol": "AVGO",  "name": "Broadcom Inc.",                     "sector": "Technology"},
        {"symbol": "ORCL",  "name": "Oracle Corporation",               "sector": "Technology"},
        {"symbol": "CSCO",  "name": "Cisco Systems Inc.",                "sector": "Technology"},
        {"symbol": "CRM",   "name": "Salesforce Inc.",                   "sector": "Technology"},
        {"symbol": "ACN",   "name": "Accenture plc",                    "sector": "Technology"},
        {"symbol": "ADBE",  "name": "Adobe Inc.",                        "sector": "Technology"},
        {"symbol": "AMD",   "name": "Advanced Micro Devices Inc.",       "sector": "Technology"},
        {"symbol": "INTC",  "name": "Intel Corporation",                 "sector": "Technology"},
        {"symbol": "IBM",   "name": "International Business Machines",   "sector": "Technology"},
        {"symbol": "TXN",   "name": "Texas Instruments Inc.",            "sector": "Technology"},
        {"symbol": "QCOM",  "name": "Qualcomm Inc.",                     "sector": "Technology"},
        {"symbol": "INTU",  "name": "Intuit Inc.",                       "sector": "Technology"},
        {"symbol": "AMAT",  "name": "Applied Materials Inc.",            "sector": "Technology"},
        {"symbol": "NOW",   "name": "ServiceNow Inc.",                   "sector": "Technology"},
        {"symbol": "MU",    "name": "Micron Technology Inc.",            "sector": "Technology"},
        {"symbol": "LRCX",  "name": "Lam Research Corporation",         "sector": "Technology"},
        {"symbol": "KLAC",  "name": "KLA Corporation",                  "sector": "Technology"},
        {"symbol": "SNPS",  "name": "Synopsys Inc.",                     "sector": "Technology"},
        {"symbol": "CDNS",  "name": "Cadence Design Systems Inc.",      "sector": "Technology"},
        {"symbol": "PLTR",  "name": "Palantir Technologies Inc.",       "sector": "Technology"},

        # ── Healthcare ───────────────────────────────────────────────
        {"symbol": "UNH",   "name": "UnitedHealth Group Inc.",          "sector": "Healthcare"},
        {"symbol": "JNJ",   "name": "Johnson & Johnson",                "sector": "Healthcare"},
        {"symbol": "LLY",   "name": "Eli Lilly and Company",            "sector": "Healthcare"},
        {"symbol": "ABBV",  "name": "AbbVie Inc.",                       "sector": "Healthcare"},
        {"symbol": "MRK",   "name": "Merck & Co. Inc.",                  "sector": "Healthcare"},
        {"symbol": "PFE",   "name": "Pfizer Inc.",                       "sector": "Healthcare"},
        {"symbol": "TMO",   "name": "Thermo Fisher Scientific Inc.",    "sector": "Healthcare"},
        {"symbol": "ABT",   "name": "Abbott Laboratories",              "sector": "Healthcare"},
        {"symbol": "DHR",   "name": "Danaher Corporation",              "sector": "Healthcare"},
        {"symbol": "AMGN",  "name": "Amgen Inc.",                        "sector": "Healthcare"},
        {"symbol": "BMY",   "name": "Bristol-Myers Squibb Company",     "sector": "Healthcare"},
        {"symbol": "GILD",  "name": "Gilead Sciences Inc.",              "sector": "Healthcare"},
        {"symbol": "ISRG",  "name": "Intuitive Surgical Inc.",          "sector": "Healthcare"},

        # ── Financials ───────────────────────────────────────────────
        {"symbol": "JPM",   "name": "JPMorgan Chase & Co.",             "sector": "Financials"},
        {"symbol": "V",     "name": "Visa Inc.",                         "sector": "Financials"},
        {"symbol": "MA",    "name": "Mastercard Incorporated",          "sector": "Financials"},
        {"symbol": "BAC",   "name": "Bank of America Corporation",      "sector": "Financials"},
        {"symbol": "WFC",   "name": "Wells Fargo & Company",            "sector": "Financials"},
        {"symbol": "GS",    "name": "Goldman Sachs Group Inc.",          "sector": "Financials"},
        {"symbol": "MS",    "name": "Morgan Stanley",                    "sector": "Financials"},
        {"symbol": "BLK",   "name": "BlackRock Inc.",                    "sector": "Financials"},
        {"symbol": "SCHW",  "name": "Charles Schwab Corporation",       "sector": "Financials"},
        {"symbol": "AXP",   "name": "American Express Company",         "sector": "Financials"},
        {"symbol": "C",     "name": "Citigroup Inc.",                    "sector": "Financials"},
        {"symbol": "SPGI",  "name": "S&P Global Inc.",                   "sector": "Financials"},

        # ── Consumer Discretionary ────────────────────────────────────
        {"symbol": "AMZN",  "name": "Amazon.com Inc.",                   "sector": "Consumer Discretionary"},
        {"symbol": "TSLA",  "name": "Tesla Inc.",                        "sector": "Consumer Discretionary"},
        {"symbol": "HD",    "name": "The Home Depot Inc.",               "sector": "Consumer Discretionary"},
        {"symbol": "MCD",   "name": "McDonald's Corporation",           "sector": "Consumer Discretionary"},
        {"symbol": "NKE",   "name": "NIKE Inc.",                         "sector": "Consumer Discretionary"},
        {"symbol": "LOW",   "name": "Lowe's Companies Inc.",            "sector": "Consumer Discretionary"},
        {"symbol": "SBUX",  "name": "Starbucks Corporation",            "sector": "Consumer Discretionary"},
        {"symbol": "TJX",   "name": "The TJX Companies Inc.",           "sector": "Consumer Discretionary"},
        {"symbol": "BKNG",  "name": "Booking Holdings Inc.",            "sector": "Consumer Discretionary"},
        {"symbol": "CMG",   "name": "Chipotle Mexican Grill Inc.",      "sector": "Consumer Discretionary"},

        # ── Consumer Staples ─────────────────────────────────────────
        {"symbol": "PG",    "name": "Procter & Gamble Company",         "sector": "Consumer Staples"},
        {"symbol": "KO",    "name": "The Coca-Cola Company",            "sector": "Consumer Staples"},
        {"symbol": "PEP",   "name": "PepsiCo Inc.",                      "sector": "Consumer Staples"},
        {"symbol": "COST",  "name": "Costco Wholesale Corporation",     "sector": "Consumer Staples"},
        {"symbol": "WMT",   "name": "Walmart Inc.",                      "sector": "Consumer Staples"},
        {"symbol": "PM",    "name": "Philip Morris International Inc.", "sector": "Consumer Staples"},
        {"symbol": "MDLZ",  "name": "Mondelez International Inc.",      "sector": "Consumer Staples"},
        {"symbol": "CL",    "name": "Colgate-Palmolive Company",        "sector": "Consumer Staples"},
        {"symbol": "KHC",   "name": "The Kraft Heinz Company",          "sector": "Consumer Staples"},

        # ── Communication Services ───────────────────────────────────
        {"symbol": "NFLX",  "name": "Netflix Inc.",                      "sector": "Communication Services"},
        {"symbol": "DIS",   "name": "The Walt Disney Company",          "sector": "Communication Services"},
        {"symbol": "CMCSA", "name": "Comcast Corporation",              "sector": "Communication Services"},
        {"symbol": "TMUS",  "name": "T-Mobile US Inc.",                  "sector": "Communication Services"},
        {"symbol": "VZ",    "name": "Verizon Communications Inc.",      "sector": "Communication Services"},
        {"symbol": "T",     "name": "AT&T Inc.",                         "sector": "Communication Services"},
        {"symbol": "CHTR",  "name": "Charter Communications Inc.",      "sector": "Communication Services"},
        {"symbol": "EA",    "name": "Electronic Arts Inc.",              "sector": "Communication Services"},

        # ── Industrials ──────────────────────────────────────────────
        {"symbol": "CAT",   "name": "Caterpillar Inc.",                  "sector": "Industrials"},
        {"symbol": "UNP",   "name": "Union Pacific Corporation",        "sector": "Industrials"},
        {"symbol": "RTX",   "name": "RTX Corporation",                  "sector": "Industrials"},
        {"symbol": "HON",   "name": "Honeywell International Inc.",     "sector": "Industrials"},
        {"symbol": "BA",    "name": "The Boeing Company",               "sector": "Industrials"},
        {"symbol": "GE",    "name": "GE Aerospace",                     "sector": "Industrials"},
        {"symbol": "LMT",   "name": "Lockheed Martin Corporation",      "sector": "Industrials"},
        {"symbol": "DE",    "name": "Deere & Company",                   "sector": "Industrials"},
        {"symbol": "UPS",   "name": "United Parcel Service Inc.",       "sector": "Industrials"},
        {"symbol": "MMM",   "name": "3M Company",                        "sector": "Industrials"},
        {"symbol": "WM",    "name": "Waste Management Inc.",            "sector": "Industrials"},

        # ── Energy ───────────────────────────────────────────────────
        {"symbol": "XOM",   "name": "Exxon Mobil Corporation",          "sector": "Energy"},
        {"symbol": "CVX",   "name": "Chevron Corporation",              "sector": "Energy"},
        {"symbol": "COP",   "name": "ConocoPhillips",                   "sector": "Energy"},
        {"symbol": "SLB",   "name": "Schlumberger Limited",             "sector": "Energy"},
        {"symbol": "EOG",   "name": "EOG Resources Inc.",               "sector": "Energy"},
        {"symbol": "MPC",   "name": "Marathon Petroleum Corporation",   "sector": "Energy"},
        {"symbol": "PSX",   "name": "Phillips 66",                      "sector": "Energy"},
        {"symbol": "VLO",   "name": "Valero Energy Corporation",        "sector": "Energy"},
        {"symbol": "OXY",   "name": "Occidental Petroleum Corporation", "sector": "Energy"},

        # ── Utilities ────────────────────────────────────────────────
        {"symbol": "NEE",   "name": "NextEra Energy Inc.",              "sector": "Utilities"},
        {"symbol": "DUK",   "name": "Duke Energy Corporation",          "sector": "Utilities"},
        {"symbol": "SO",    "name": "The Southern Company",             "sector": "Utilities"},
        {"symbol": "D",     "name": "Dominion Energy Inc.",             "sector": "Utilities"},
        {"symbol": "AEP",   "name": "American Electric Power Co.",      "sector": "Utilities"},
        {"symbol": "SRE",   "name": "Sempra",                           "sector": "Utilities"},
        {"symbol": "EXC",   "name": "Exelon Corporation",               "sector": "Utilities"},
        {"symbol": "XEL",   "name": "Xcel Energy Inc.",                  "sector": "Utilities"},

        # ── Materials ────────────────────────────────────────────────
        {"symbol": "LIN",   "name": "Linde plc",                        "sector": "Materials"},
        {"symbol": "APD",   "name": "Air Products and Chemicals Inc.",  "sector": "Materials"},
        {"symbol": "SHW",   "name": "Sherwin-Williams Company",         "sector": "Materials"},
        {"symbol": "ECL",   "name": "Ecolab Inc.",                       "sector": "Materials"},
        {"symbol": "FCX",   "name": "Freeport-McMoRan Inc.",            "sector": "Materials"},
        {"symbol": "NEM",   "name": "Newmont Corporation",              "sector": "Materials"},
        {"symbol": "DOW",   "name": "Dow Inc.",                          "sector": "Materials"},
        {"symbol": "NUE",   "name": "Nucor Corporation",                "sector": "Materials"},

        # ── Real Estate ──────────────────────────────────────────────
        {"symbol": "PLD",   "name": "Prologis Inc.",                     "sector": "Real Estate"},
        {"symbol": "AMT",   "name": "American Tower Corporation",       "sector": "Real Estate"},
        {"symbol": "CCI",   "name": "Crown Castle Inc.",                 "sector": "Real Estate"},
        {"symbol": "EQIX",  "name": "Equinix Inc.",                      "sector": "Real Estate"},
        {"symbol": "PSA",   "name": "Public Storage",                    "sector": "Real Estate"},
        {"symbol": "SPG",   "name": "Simon Property Group Inc.",         "sector": "Real Estate"},
        {"symbol": "O",     "name": "Realty Income Corporation",         "sector": "Real Estate"},
        {"symbol": "WELL",  "name": "Welltower Inc.",                    "sector": "Real Estate"},
        {"symbol": "DLR",   "name": "Digital Realty Trust Inc.",         "sector": "Real Estate"},
    ]

    # ── Top 50 Cryptocurrency Pairs ──────────────────────────────────

    _CRYPTO: list[dict] = [
        {"symbol": "BTCUSD",   "name": "Bitcoin",                 "sector": "Layer 1"},
        {"symbol": "ETHUSD",   "name": "Ethereum",                "sector": "Layer 1"},
        {"symbol": "BNBUSD",   "name": "BNB",                     "sector": "Layer 1"},
        {"symbol": "XRPUSD",   "name": "Ripple",                  "sector": "Payments"},
        {"symbol": "SOLUSD",   "name": "Solana",                  "sector": "Layer 1"},
        {"symbol": "ADAUSD",   "name": "Cardano",                 "sector": "Layer 1"},
        {"symbol": "DOGEUSD",  "name": "Dogecoin",                "sector": "Meme"},
        {"symbol": "TRXUSD",   "name": "TRON",                    "sector": "Layer 1"},
        {"symbol": "AVAXUSD",  "name": "Avalanche",               "sector": "Layer 1"},
        {"symbol": "DOTUSD",   "name": "Polkadot",                "sector": "Layer 0"},
        {"symbol": "LINKUSD",  "name": "Chainlink",               "sector": "Oracle"},
        {"symbol": "MATICUSD", "name": "Polygon",                 "sector": "Layer 2"},
        {"symbol": "SHIBUSD",  "name": "Shiba Inu",               "sector": "Meme"},
        {"symbol": "LTCUSD",   "name": "Litecoin",                "sector": "Payments"},
        {"symbol": "UNIUSD",   "name": "Uniswap",                 "sector": "DeFi"},
        {"symbol": "ATOMUSD",  "name": "Cosmos",                  "sector": "Layer 0"},
        {"symbol": "XLMUSD",   "name": "Stellar",                 "sector": "Payments"},
        {"symbol": "BCHUSD",   "name": "Bitcoin Cash",            "sector": "Payments"},
        {"symbol": "NEARUSD",  "name": "NEAR Protocol",           "sector": "Layer 1"},
        {"symbol": "ICPUSD",   "name": "Internet Computer",       "sector": "Layer 1"},
        {"symbol": "FILUSD",   "name": "Filecoin",                "sector": "Storage"},
        {"symbol": "APTUSD",   "name": "Aptos",                   "sector": "Layer 1"},
        {"symbol": "ARBUSD",   "name": "Arbitrum",                "sector": "Layer 2"},
        {"symbol": "OPUSD",    "name": "Optimism",                "sector": "Layer 2"},
        {"symbol": "MKRUSD",   "name": "Maker",                   "sector": "DeFi"},
        {"symbol": "AAVEUSD",  "name": "Aave",                    "sector": "DeFi"},
        {"symbol": "GRTUSD",   "name": "The Graph",               "sector": "Infrastructure"},
        {"symbol": "ALGOUSD",  "name": "Algorand",                "sector": "Layer 1"},
        {"symbol": "FTMUSD",   "name": "Fantom",                  "sector": "Layer 1"},
        {"symbol": "SANDUSD",  "name": "The Sandbox",             "sector": "Metaverse"},
        {"symbol": "MANAUSD",  "name": "Decentraland",            "sector": "Metaverse"},
        {"symbol": "AXSUSD",   "name": "Axie Infinity",           "sector": "Gaming"},
        {"symbol": "THETAUSD", "name": "Theta Network",           "sector": "Infrastructure"},
        {"symbol": "EGLDUSD",  "name": "MultiversX",              "sector": "Layer 1"},
        {"symbol": "INJUSD",   "name": "Injective",               "sector": "DeFi"},
        {"symbol": "RUNEUSD",  "name": "THORChain",               "sector": "DeFi"},
        {"symbol": "LDOUSD",   "name": "Lido DAO",                "sector": "DeFi"},
        {"symbol": "RNDRUSD",  "name": "Render Token",            "sector": "Infrastructure"},
        {"symbol": "SUIUSD",   "name": "Sui",                     "sector": "Layer 1"},
        {"symbol": "SEIUSD",   "name": "Sei",                     "sector": "Layer 1"},
        {"symbol": "PEPEUSD",  "name": "Pepe",                    "sector": "Meme"},
        {"symbol": "HBARUSD",  "name": "Hedera",                  "sector": "Layer 1"},
        {"symbol": "VETUSD",   "name": "VeChain",                 "sector": "Supply Chain"},
        {"symbol": "IMXUSD",   "name": "Immutable X",             "sector": "Layer 2"},
        {"symbol": "QNTUSD",   "name": "Quant",                   "sector": "Infrastructure"},
        {"symbol": "TIAUSD",   "name": "Celestia",                "sector": "Layer 0"},
        {"symbol": "STXUSD",   "name": "Stacks",                  "sector": "Layer 2"},
        {"symbol": "ENSUSD",   "name": "Ethereum Name Service",   "sector": "Infrastructure"},
        {"symbol": "WLDUSD",   "name": "Worldcoin",               "sector": "Identity"},
        {"symbol": "COMPUSD",  "name": "Compound",                "sector": "DeFi"},
    ]

    # ── All 28 Major and Minor Forex Pairs ───────────────────────────

    _FOREX: list[dict] = [
        # Majors (7 pairs)
        {"symbol": "EURUSD", "name": "Euro / US Dollar",                    "sector": "Major"},
        {"symbol": "GBPUSD", "name": "British Pound / US Dollar",           "sector": "Major"},
        {"symbol": "USDJPY", "name": "US Dollar / Japanese Yen",            "sector": "Major"},
        {"symbol": "USDCHF", "name": "US Dollar / Swiss Franc",             "sector": "Major"},
        {"symbol": "AUDUSD", "name": "Australian Dollar / US Dollar",       "sector": "Major"},
        {"symbol": "USDCAD", "name": "US Dollar / Canadian Dollar",         "sector": "Major"},
        {"symbol": "NZDUSD", "name": "New Zealand Dollar / US Dollar",      "sector": "Major"},

        # Crosses — EUR crosses (3)
        {"symbol": "EURGBP", "name": "Euro / British Pound",                "sector": "Cross"},
        {"symbol": "EURJPY", "name": "Euro / Japanese Yen",                 "sector": "Cross"},
        {"symbol": "EURCHF", "name": "Euro / Swiss Franc",                  "sector": "Cross"},

        # Crosses — GBP crosses (3)
        {"symbol": "GBPJPY", "name": "British Pound / Japanese Yen",        "sector": "Cross"},
        {"symbol": "GBPCHF", "name": "British Pound / Swiss Franc",         "sector": "Cross"},
        {"symbol": "GBPAUD", "name": "British Pound / Australian Dollar",   "sector": "Cross"},

        # Crosses — AUD/NZD crosses (4)
        {"symbol": "AUDJPY", "name": "Australian Dollar / Japanese Yen",    "sector": "Cross"},
        {"symbol": "AUDNZD", "name": "Australian Dollar / New Zealand Dollar", "sector": "Cross"},
        {"symbol": "AUDCAD", "name": "Australian Dollar / Canadian Dollar",  "sector": "Cross"},
        {"symbol": "AUDCHF", "name": "Australian Dollar / Swiss Franc",     "sector": "Cross"},

        # Crosses — NZD crosses (2)
        {"symbol": "NZDJPY", "name": "New Zealand Dollar / Japanese Yen",   "sector": "Cross"},
        {"symbol": "NZDCAD", "name": "New Zealand Dollar / Canadian Dollar", "sector": "Cross"},

        # Crosses — CAD/CHF crosses (3)
        {"symbol": "CADJPY", "name": "Canadian Dollar / Japanese Yen",      "sector": "Cross"},
        {"symbol": "CADCHF", "name": "Canadian Dollar / Swiss Franc",       "sector": "Cross"},
        {"symbol": "CHFJPY", "name": "Swiss Franc / Japanese Yen",          "sector": "Cross"},

        # Crosses — EUR with commodity currencies (3)
        {"symbol": "EURAUD", "name": "Euro / Australian Dollar",            "sector": "Cross"},
        {"symbol": "EURNZD", "name": "Euro / New Zealand Dollar",           "sector": "Cross"},
        {"symbol": "EURCAD", "name": "Euro / Canadian Dollar",              "sector": "Cross"},

        # Additional minor — GBP with commodity (2)
        {"symbol": "GBPNZD", "name": "British Pound / New Zealand Dollar",  "sector": "Cross"},
        {"symbol": "GBPCAD", "name": "British Pound / Canadian Dollar",     "sector": "Cross"},
    ]

    # ── Unified registry ─────────────────────────────────────────────

    _UNIVERSES: dict[str, list[dict]] = {
        "stocks": _STOCKS,
        "crypto": _CRYPTO,
        "forex":  _FOREX,
    }

    # ── Public API ───────────────────────────────────────────────────

    def get_universe(self, market_type: str) -> list[dict]:
        """Return full ticker list for a market type, each with market_type tag."""
        raw = self._UNIVERSES.get(market_type.lower(), [])
        return [
            {**entry, "market_type": market_type.lower()}
            for entry in raw
        ]

    def get_sectors(self, market_type: str) -> list[str]:
        """Return sorted unique sectors for a market type."""
        raw = self._UNIVERSES.get(market_type.lower(), [])
        return sorted({entry["sector"] for entry in raw})

    def search(self, query: str, market_type: Optional[str] = None) -> list[dict]:
        """Case-insensitive search across symbol and name fields.

        If *market_type* is given, search is restricted to that universe;
        otherwise all universes are searched.
        """
        q = query.lower()
        results: list[dict] = []

        if market_type:
            universes = {market_type.lower(): self._UNIVERSES.get(market_type.lower(), [])}
        else:
            universes = self._UNIVERSES

        for mtype, entries in universes.items():
            for entry in entries:
                if (
                    q in entry["symbol"].lower()
                    or q in entry["name"].lower()
                    or q in entry["sector"].lower()
                ):
                    results.append({**entry, "market_type": mtype})

        return results

    def get_by_sector(self, sector: str) -> list[dict]:
        """Return all tickers matching a sector across all market types."""
        s = sector.lower()
        results: list[dict] = []
        for mtype, entries in self._UNIVERSES.items():
            for entry in entries:
                if entry["sector"].lower() == s:
                    results.append({**entry, "market_type": mtype})
        return results

    def get_all_market_types(self) -> list[str]:
        """Return available market type keys."""
        return list(self._UNIVERSES.keys())
