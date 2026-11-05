"""
CLI Runner to evaluate the Multilingual RxR VLN Decision Agent.
Evaluates task success (SR), route efficiency (SPL), trajectory alignment (nDTW, sDTW),
and navigation error across English, Hindi, and Telugu in Seen and Unseen environments.
"""

import sys
import json
from rxr_agent.evaluation.benchmark import RxRBenchmarkRunner


def main():
    print("=" * 75)
    print("   Room-Across-Room (RxR) Multilingual VLN Decision Agent Benchmark")
    print("   Evaluating Goal-Based Agent & State-Space Sequential Decision Engine")
    print("=" * 75)
    print("\nRunning episodic rollouts across English, Hindi, and Telugu...")

    runner = RxRBenchmarkRunner()
    result = runner.run_benchmark(languages=["en", "hi", "te"])

    print("\n" + result.to_markdown_table() + "\n")

    # Save detailed JSON summary
    summary_data = {
        "overall": result.overall,
        "by_language": result.by_language,
        "by_split": result.by_split,
        "matrix": result.matrix,
        "num_episodes_evaluated": len(result.episodes_metrics)
    }

    out_file = "benchmark_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)

    print(f"Detailed benchmark results saved to {out_file}\n")


if __name__ == "__main__":
    main()
