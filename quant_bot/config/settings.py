import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

SYMBOL = "BTC/USDT"
EXCHANGE_ID = "binanceusdm"

TIMEFRAMES = ["1m", "5m", "15m", "1h"]

OHLCV_LIMIT = 1000

COLLECT_INTERVAL_SECONDS = 60

ORDERBOOK_DEPTH = 20
