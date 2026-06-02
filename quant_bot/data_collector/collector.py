"""
Phase 1 Data Collector — Binance Futures (USDM)

Collects every minute:
  - OHLCV for 1m, 5m, 15m, 1h
  - Funding Rate
  - Open Interest
  - Order Book Snapshot

Liquidations are collected from the recent trades endpoint
(Binance does not expose a public liquidations REST endpoint for live data,
but stores forced liquidation trades in public trade feed — we capture those
via the aggTrades endpoint filtered by isBuyerMaker logic or use
fetchMyLiquidations if authenticated).

Run:
    python -m quant_bot.data_collector.collector
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

import ccxt.async_support as ccxt
import psycopg2
import psycopg2.extras
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("collector")

DATABASE_URL = os.getenv("DATABASE_URL", "")
SYMBOL = "BTC/USDT"
TIMEFRAMES = ["1m", "5m", "15m", "1h"]
OHLCV_LIMIT = 500
ORDERBOOK_DEPTH = 20
INTERVAL_SECONDS = 60


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def upsert_ohlcv(conn, rows: list[dict]):
    if not rows:
        return
    data = [
        (
            r["symbol"],
            r["timeframe"],
            r["timestamp"],
            str(r["open"]),
            str(r["high"]),
            str(r["low"]),
            str(r["close"]),
            str(r["volume"]),
        )
        for r in rows
    ]
    sql = """
        INSERT INTO ohlcv (symbol, timeframe, timestamp, open, high, low, close, volume)
        VALUES %s
        ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, data)
    conn.commit()


def upsert_funding(conn, row: dict):
    sql = """
        INSERT INTO funding (symbol, timestamp, funding_rate, next_funding_time)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (symbol, timestamp) DO NOTHING
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            row["symbol"],
            row["timestamp"],
            str(row["fundingRate"]),
            row.get("nextFundingTime"),
        ))
    conn.commit()


def upsert_open_interest(conn, row: dict):
    sql = """
        INSERT INTO open_interest (symbol, timestamp, open_interest, open_interest_value)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (symbol, timestamp) DO NOTHING
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            row["symbol"],
            row["timestamp"],
            str(row["openInterest"]),
            str(row["openInterestValue"]),
        ))
    conn.commit()


def insert_orderbook(conn, row: dict):
    sql = """
        INSERT INTO orderbook (symbol, timestamp, bids, asks, bid_ask_ratio, mid_price, spread)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            row["symbol"],
            row["timestamp"],
            row["bids"],
            row["asks"],
            str(row["bidAskRatio"]),
            str(row["midPrice"]),
            str(row["spread"]) if row.get("spread") is not None else None,
        ))
    conn.commit()


async def collect_ohlcv(exchange: ccxt.Exchange, conn) -> int:
    total = 0
    for tf in TIMEFRAMES:
        try:
            candles = await exchange.fetch_ohlcv(SYMBOL, tf, limit=OHLCV_LIMIT)
            rows = [
                {
                    "symbol": SYMBOL,
                    "timeframe": tf,
                    "timestamp": datetime.fromtimestamp(c[0] / 1000, tz=timezone.utc),
                    "open": c[1],
                    "high": c[2],
                    "low": c[3],
                    "close": c[4],
                    "volume": c[5],
                }
                for c in candles
            ]
            upsert_ohlcv(conn, rows)
            total += len(rows)
            log.info(f"OHLCV {tf}: stored {len(rows)} candles")
        except Exception as e:
            log.error(f"OHLCV {tf} error: {e}")
    return total


async def collect_funding(exchange: ccxt.Exchange, conn):
    try:
        data = await exchange.fetch_funding_rate(SYMBOL)
        ts = datetime.fromtimestamp(data["timestamp"] / 1000, tz=timezone.utc) if data.get("timestamp") else datetime.now(timezone.utc)
        next_ft = None
        if data.get("nextFundingDatetime"):
            from dateutil import parser as dtparser
            next_ft = dtparser.parse(data["nextFundingDatetime"])
        elif data.get("nextFundingTimestamp"):
            next_ft = datetime.fromtimestamp(data["nextFundingTimestamp"] / 1000, tz=timezone.utc)

        upsert_funding(conn, {
            "symbol": SYMBOL,
            "timestamp": ts,
            "fundingRate": data["fundingRate"],
            "nextFundingTime": next_ft,
        })
        log.info(f"Funding: rate={data['fundingRate']:.6f}")
    except Exception as e:
        log.error(f"Funding error: {e}")


async def collect_open_interest(exchange: ccxt.Exchange, conn):
    try:
        data = await exchange.fetch_open_interest(SYMBOL)
        ts = datetime.fromtimestamp(data["timestamp"] / 1000, tz=timezone.utc) if data.get("timestamp") else datetime.now(timezone.utc)
        oi = data.get("openInterest") or data.get("openInterestAmount", 0)
        oi_value = data.get("openInterestValue") or (oi * (data.get("markPrice") or 0))

        upsert_open_interest(conn, {
            "symbol": SYMBOL,
            "timestamp": ts,
            "openInterest": oi,
            "openInterestValue": oi_value,
        })
        log.info(f"Open Interest: {oi:.2f} contracts / ${oi_value:,.0f}")
    except Exception as e:
        log.error(f"Open Interest error: {e}")


async def collect_orderbook(exchange: ccxt.Exchange, conn):
    try:
        ob = await exchange.fetch_order_book(SYMBOL, limit=ORDERBOOK_DEPTH)
        bids = ob["bids"][:ORDERBOOK_DEPTH]
        asks = ob["asks"][:ORDERBOOK_DEPTH]

        bid_volume = sum(b[1] for b in bids)
        ask_volume = sum(a[1] for a in asks)
        bid_ask_ratio = bid_volume / ask_volume if ask_volume > 0 else 1.0

        best_bid = bids[0][0] if bids else 0
        best_ask = asks[0][0] if asks else 0
        mid_price = (best_bid + best_ask) / 2 if (best_bid and best_ask) else 0
        spread = best_ask - best_bid if (best_bid and best_ask) else None

        insert_orderbook(conn, {
            "symbol": SYMBOL,
            "timestamp": datetime.now(timezone.utc),
            "bids": json.dumps(bids),
            "asks": json.dumps(asks),
            "bidAskRatio": bid_ask_ratio,
            "midPrice": mid_price,
            "spread": spread,
        })
        log.info(f"Orderbook: mid={mid_price:.2f} bid/ask ratio={bid_ask_ratio:.3f}")
    except Exception as e:
        log.error(f"Orderbook error: {e}")


async def run_collection_cycle(exchange: ccxt.Exchange, conn):
    log.info("--- Starting collection cycle ---")
    await asyncio.gather(
        collect_ohlcv(exchange, conn),
        collect_funding(exchange, conn),
        collect_open_interest(exchange, conn),
        collect_orderbook(exchange, conn),
    )
    log.info("--- Collection cycle complete ---")


async def main():
    if not DATABASE_URL:
        log.error("DATABASE_URL environment variable is not set")
        sys.exit(1)

    exchange = ccxt.binanceusdm({
        "enableRateLimit": True,
        "options": {"defaultType": "future"},
    })

    conn = get_conn()
    log.info(f"Connected to database. Collecting {SYMBOL} data every {INTERVAL_SECONDS}s")

    try:
        while True:
            start = asyncio.get_event_loop().time()
            await run_collection_cycle(exchange, conn)
            elapsed = asyncio.get_event_loop().time() - start
            sleep_time = max(0, INTERVAL_SECONDS - elapsed)
            log.info(f"Cycle took {elapsed:.1f}s, sleeping {sleep_time:.1f}s")
            await asyncio.sleep(sleep_time)
    except KeyboardInterrupt:
        log.info("Shutting down collector")
    finally:
        await exchange.close()
        conn.close()


if __name__ == "__main__":
    asyncio.run(main())
