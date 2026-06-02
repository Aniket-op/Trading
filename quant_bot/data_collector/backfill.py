"""
Historical Backfill — fetch 6 months of OHLCV data from Binance Futures.

Run once to populate historical data:
    python -m quant_bot.data_collector.backfill

This will collect ~6 months of 1m, 5m, 15m, 1h candles for BTC/USDT.
Rate limits are respected via CCXT's built-in limiter.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone, timedelta

import ccxt.async_support as ccxt
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("backfill")

DATABASE_URL = os.getenv("DATABASE_URL", "")
SYMBOL = "BTC/USDT"
TIMEFRAMES = ["1m", "5m", "15m", "1h"]
MONTHS_BACK = 6
BATCH_SIZE = 1000


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def bulk_upsert_ohlcv(conn, rows: list):
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
        execute_values(cur, sql, data, page_size=500)
    conn.commit()


async def backfill_timeframe(exchange: ccxt.Exchange, conn, tf: str):
    since = datetime.now(timezone.utc) - timedelta(days=MONTHS_BACK * 30)
    since_ms = int(since.timestamp() * 1000)
    total = 0

    log.info(f"Backfilling {tf} from {since.date()} ...")

    while True:
        try:
            candles = await exchange.fetch_ohlcv(SYMBOL, tf, since=since_ms, limit=BATCH_SIZE)
        except Exception as e:
            log.error(f"Error fetching {tf}: {e}")
            await asyncio.sleep(5)
            continue

        if not candles:
            break

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

        bulk_upsert_ohlcv(conn, rows)
        total += len(rows)

        last_ts = candles[-1][0]
        last_dt = datetime.fromtimestamp(last_ts / 1000, tz=timezone.utc)
        log.info(f"  {tf}: {total} candles stored, up to {last_dt.isoformat()}")

        if last_ts >= int(datetime.now(timezone.utc).timestamp() * 1000):
            break

        since_ms = last_ts + 1
        await asyncio.sleep(exchange.rateLimit / 1000)

    log.info(f"Done backfilling {tf}: {total} total candles")
    return total


async def main():
    if not DATABASE_URL:
        log.error("DATABASE_URL is not set")
        sys.exit(1)

    exchange = ccxt.binanceusdm({
        "enableRateLimit": True,
        "options": {"defaultType": "future"},
    })

    conn = get_conn()
    log.info(f"Starting backfill of {MONTHS_BACK} months for {SYMBOL}")

    try:
        for tf in TIMEFRAMES:
            await backfill_timeframe(exchange, conn, tf)
    finally:
        await exchange.close()
        conn.close()

    log.info("Backfill complete!")


if __name__ == "__main__":
    asyncio.run(main())
