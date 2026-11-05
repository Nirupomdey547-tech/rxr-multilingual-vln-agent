"""
CLI Runner to launch the interactive web simulator for RxR VLN.
"""

import sys
import argparse
from rxr_agent.simulator.server import run_simulator_server


def main():
    parser = argparse.ArgumentParser(description="Launch RxR VLN Interactive Simulator")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind simulator web server (default: 8080)")
    parser.add_argument("--episode", type=str, default="rxr_seen1_ep01", help="Initial episode ID")
    parser.add_argument("--lang", type=str, default="en", choices=["en", "hi", "te"], help="Initial language")

    args = parser.parse_args()

    run_simulator_server(port=args.port, initial_episode=args.episode, initial_lang=args.lang)


if __name__ == "__main__":
    main()
