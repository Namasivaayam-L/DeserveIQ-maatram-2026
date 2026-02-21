#!/usr/bin/env python3
"""
Health Monitor Script for DeserveIQ Services
Continuously monitors health endpoints of both Spring Boot and ML services
"""

import requests
import time
import datetime
import logging
import sys

# URLs to monitor
URLS = [
    "https://deserveiq-maatram-2026.onrender.com/health",
    "https://deserveiq-maatram-2026-spring.onrender.com/health"
]

# Set up logging
logging.basicConfig(
    filename='health_monitor.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Also log to console
console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
console.setFormatter(formatter)
logging.getLogger('').addHandler(console)

logger = logging.getLogger(__name__)

def check_health(url, timeout=10):
    """
    Check health of a single endpoint
    """
    try:
        start_time = time.time()
        response = requests.get(url, timeout=timeout)
        response_time = time.time() - start_time

        if response.status_code == 200:
            logger.info(f"✅ {url} - Status: {response.status_code} - Response Time: {response_time:.2f}s - Body: {response.text}")
            return True
        else:
            logger.warning(f"⚠️  {url} - Status: {response.status_code} - Response Time: {response_time:.2f}s - Body: {response.text}")
            return False

    except requests.exceptions.Timeout:
        logger.error(f"❌ {url} - TIMEOUT after {timeout}s")
        return False
    except requests.exceptions.ConnectionError:
        logger.error(f"❌ {url} - CONNECTION ERROR")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ {url} - REQUEST ERROR: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"❌ {url} - UNEXPECTED ERROR: {str(e)}")
        return False

def main():
    """
    Main monitoring loop
    """
    logger.info("🚀 Starting Health Monitor for DeserveIQ Services")
    logger.info("=" * 60)
    logger.info("Monitoring URLs:")
    for url in URLS:
        logger.info(f"  - {url}")
    logger.info("=" * 60)
    logger.info("Press Ctrl+C to stop monitoring")
    logger.info("Logs are being saved to: health_monitor.log")
    logger.info("=" * 60)

    try:
        while True:
            logger.info("🔍 Checking all health endpoints...")

            all_healthy = True
            for url in URLS:
                if not check_health(url):
                    all_healthy = False

            if all_healthy:
                logger.info("✅ All services are healthy")
            else:
                logger.warning("⚠️  Some services are unhealthy")

            logger.info("-" * 40)
            time.sleep(14*60)  # Wait 14 minutes before next check

    except KeyboardInterrupt:
        logger.info("🛑 Monitoring stopped by user (Ctrl+C)")
        logger.info("=" * 60)
        sys.exit(0)

    except Exception as e:
        logger.error(f"💥 Unexpected error in main loop: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
