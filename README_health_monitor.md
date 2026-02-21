# Health Monitor for DeserveIQ Services

This Python script continuously monitors the health endpoints of both DeserveIQ services at 30-second intervals.

## Services Monitored

1. **Spring Boot Backend**: `https://deserveiq-maatram-2026.onrender.com/health`
2. **ML Service**: `https://deserveiq-maatram-2026-spring.onrender.com/health`

## Features

- ✅ Continuous monitoring with 30-second intervals
- ✅ Comprehensive logging with readable timestamps
- ✅ Response time measurement
- ✅ Error handling for network issues, timeouts, and connection errors
- ✅ Logs both to console and file (`health_monitor.log`)
- ✅ Graceful shutdown with Ctrl+C
- ✅ Visual indicators (✅ ⚠️ ❌) for status

## Usage

### Prerequisites

```bash
pip install -r requirements_health_monitor.txt
```

### Running the Script

```bash
python3 health_monitor.py
```

### Stopping the Script

Press `Ctrl+C` to stop the monitoring gracefully.

## Log Format

Logs are saved to `health_monitor.log` with the following format:
```
2026-01-17 09:36:26 - INFO - ✅ https://deserveiq-maatram-2026.onrender.com/health - Status: 200 - Response Time: 0.80s - Body: {"status":"healthy"}
```

## Files

- `health_monitor.py` - Main monitoring script
- `requirements_health_monitor.txt` - Python dependencies
- `health_monitor.log` - Generated log file
- `README_health_monitor.md` - This documentation

## Expected Behavior

- **Spring Boot Service**: Should return `200 OK` with `{"status":"healthy"}`
- **ML Service**: May return `403 Forbidden` due to CORS restrictions, but this is normal for monitoring purposes

The script will continue running until manually stopped with Ctrl+C.
