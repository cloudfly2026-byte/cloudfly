#!/usr/bin/env python3
"""
CLOUD-341 - E2E Integration Test for demoMetrics.ts
QA Engineer: OWL 🦉

This script verifies the demo metrics data module by:
1. Running vitest unit tests programmatically
2. Verifying TypeScript compilation
3. Checking file existence and structure

PREREQUISITES:
- Node.js and npm installed
- frontend_new dependencies installed (npm install)
- Run from project root: C:\apps\cloudfly

EXECUTION:
    python tests/AGENTE_DEV_demoMetrics_cdp.py

EXPECTED RESULT:
    All tests pass with 0 failures
"""

import subprocess
import sys
import os

PROJECT_ROOT = r"C:\apps\cloudfly"
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend_new")


def run_command(cmd, cwd=None):
    """Run a shell command and return (success, output)."""
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or PROJECT_ROOT,
        capture_output=True, text=True, timeout=120
    )
    return result.returncode == 0, result.stdout + result.stderr


def main():
    print("=" * 60)
    print("CLOUD-341 - QA E2E Integration Test: demoMetrics.ts")
    print("=" * 60)

    all_passed = True

    # Test 1: File existence
    print("\n[TEST 1] File existence check")
    filepath = os.path.join(FRONTEND_DIR, "src", "data", "demoMetrics.ts")
    if os.path.exists(filepath):
        print(f"  ✅ PASS: demoMetrics.ts exists at {filepath}")
    else:
        print(f"  ❌ FAIL: demoMetrics.ts not found at {filepath}")
        all_passed = False

    # Test 2: File content verification
    print("\n[TEST 2] File content verification")
    with open(filepath, "r") as f:
        content = f.read()
    
    required_exports = [
        "demoVisitsByYear",
        "demoOrigins", 
        "demoTopPages",
        "demoBounceRate",
    ]
    for export in required_exports:
        if f"export const {export}" in content:
            print(f"  ✅ PASS: Export '{export}' found")
        else:
            print(f"  ❌ FAIL: Export '{export}' NOT found")
            all_passed = False

    # Test 3: TypeScript compilation (project-level)
    print("\n[TEST 3] TypeScript compilation check")
    success, output = run_command(
        "cd frontend_new && npx tsc --noEmit",
        cwd=PROJECT_ROOT
    )
    # Filter out pre-existing errors not related to demoMetrics.ts
    demo_metrics_errors = [
        line for line in output.split("\n")
        if "demoMetrics" in line and "error" in line
    ]
    if not demo_metrics_errors:
        print("  ✅ PASS: No TypeScript errors in demoMetrics.ts")
    else:
        print(f"  ❌ FAIL: TypeScript errors found in demoMetrics.ts:")
        for err in demo_metrics_errors:
            print(f"    {err}")
        all_passed = False

    # Test 4: Vitest unit tests
    print("\n[TEST 4] Vitest unit tests")
    success, output = run_command(
        "cd frontend_new && npx vitest run src/data/demoMetrics.test.ts",
        cwd=PROJECT_ROOT
    )
    if success:
        # Extract test summary
        for line in output.split("\n"):
            if "passed" in line.lower() or "failed" in line.lower():
                print(f"  ✅ PASS: {line.strip()}")
                break
    else:
        print(f"  ❌ FAIL: Vitest tests failed")
        print(f"  Output: {output[:500]}")
        all_passed = False

    # Test 5: Test file existence
    print("\n[TEST 5] Test file existence check")
    test_filepath = os.path.join(FRONTEND_DIR, "src", "data", "demoMetrics.test.ts")
    if os.path.exists(test_filepath):
        print(f"  ✅ PASS: demoMetrics.test.ts exists")
    else:
        print(f"  ❌ FAIL: demoMetrics.test.ts not found")
        all_passed = False

    # Test 6: Type interface alignment
    print("\n[TEST 6] Type interface alignment check")
    catalog_types_path = os.path.join(FRONTEND_DIR, "src", "types", "catalog.ts")
    if os.path.exists(catalog_types_path):
        with open(catalog_types_path, "r") as f:
            catalog_content = f.read()
        if "WebsiteMetrics" in catalog_content:
            print("  ✅ PASS: WebsiteMetrics interface exists in catalog.ts")
        else:
            print("  ❌ FAIL: WebsiteMetrics interface not found in catalog.ts")
            all_passed = False
    else:
        print("  ❌ FAIL: catalog.ts not found")
        all_passed = False

    # Summary
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED - CLOUD-341 QA SIGN-OFF APPROVED")
    else:
        print("❌ SOME TESTS FAILED - CLOUD-341 QA SIGN-OFF REJECTED")
    print("=" * 60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())