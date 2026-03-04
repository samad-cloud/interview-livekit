#!/usr/bin/env python3
"""
The Commander: Runs the full recruiting pipeline continuously.

This is the main entry point for Railway deployment.
It runs all scripts in sequence on a loop:
1. Ingest new applications
2. Grade candidates
3. Send outreach emails

Then sleeps and repeats.
"""

import sys
import time
from pathlib import Path

# Add read/ directory to path for importing ingest
sys.path.insert(0, str(Path(__file__).parent.parent / "read"))

from utils import get_supabase_client, get_gmail_service, log

# Import the other modules' run functions
from grader import run_grader
from mailer import run_mailer
from video_fixer import run_video_fixer

# For ingest, we need to handle the import differently since it's in a different folder
try:
    from ingest import run_ingest
except ImportError:
    # If import fails, define a stub that logs the error
    def run_ingest():
        log("WARN", "Could not import ingest module - skipping")
        return 0

# --- Configuration ---
LOOP_INTERVAL_SECONDS = 60  # How often to run the pipeline


def run_pipeline_cycle():
    """
    Run one complete cycle of the recruiting pipeline.

    Order:
    1. Ingest new applications from email
    2. Grade new candidates with AI
    3. Send outreach to graded candidates (Tally form for Dubai, direct invite for others)
    """
    log("INFO", "=" * 50)
    log("INFO", "Starting pipeline cycle...")
    log("INFO", "=" * 50)

    # Step 1: Ingest new applications
    try:
        ingested = run_ingest()
        log("INFO", f"Step 1 (Ingest): {ingested} applications ingested")
    except Exception as e:
        log("ERROR", f"Step 1 (Ingest) failed: {e}")

    # Step 2: Grade candidates
    try:
        graded = run_grader()
        log("INFO", f"Step 2 (Grader): {graded} candidates graded")
    except Exception as e:
        log("ERROR", f"Step 2 (Grader) failed: {e}")

    # Step 3: Send outreach
    try:
        dubai, invites, reminders, round_2 = run_mailer()
        log("INFO", f"Step 3 (Mailer): {dubai} eligibility forms, {invites} invites, {round_2} round 2 invites, {reminders} reminders sent")
    except Exception as e:
        log("ERROR", f"Step 3 (Mailer) failed: {e}")

    # Step 4: Remux interview recordings for seekable downloads
    try:
        fixed = run_video_fixer()
        log("INFO", f"Step 4 (VideoFixer): {fixed} recording(s) remuxed")
    except Exception as e:
        log("ERROR", f"Step 4 (VideoFixer) failed: {e}")

    log("INFO", "Pipeline cycle complete!")


def main():
    """
    Main entry point - runs the pipeline continuously.
    This is what Railway will execute.
    """
    log("INFO", "=" * 60)
    log("INFO", "RECRUITING BOT COMMANDER STARTING")
    log("INFO", f"Loop interval: {LOOP_INTERVAL_SECONDS} seconds")
    log("INFO", "=" * 60)

    # Test connections on startup
    try:
        log("INFO", "Testing Supabase connection...")
        supabase = get_supabase_client()
        log("INFO", "Supabase OK")

        log("INFO", "Testing Gmail connection...")
        gmail = get_gmail_service()
        log("INFO", "Gmail OK")

    except Exception as e:
        log("ERROR", f"Startup check failed: {e}")
        log("ERROR", "Fix the above error and restart.")
        return

    log("INFO", "All connections verified. Starting main loop...")

    # Main loop
    while True:
        try:
            run_pipeline_cycle()
        except Exception as e:
            log("ERROR", f"Pipeline cycle crashed: {e}")
            log("INFO", "Will retry on next cycle...")

        log("INFO", f"Sleeping for {LOOP_INTERVAL_SECONDS} seconds...")
        time.sleep(LOOP_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
