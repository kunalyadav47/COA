"""
Automated Artifact Capture & PDF Compiler for COA Microproject
Uses Headless Chromium to generate authentic high-resolution screenshots
and render the official academic PDF report.
"""

import subprocess
import os
import time

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROJECT_DIR = r"C:\Users\hp\.gemini\antigravity\scratch\coa-pipelining-simulator"
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots")
DOCS_DIR = os.path.join(PROJECT_DIR, "docs")

INDEX_HTML = os.path.join(PROJECT_DIR, "index.html")
REPORT_HTML = os.path.join(DOCS_DIR, "COA_Project_Report.html")
REPORT_PDF = os.path.join(DOCS_DIR, "COA_Project_Report.pdf")

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(DOCS_DIR, exist_ok=True)

# 1. Capture Screenshots
screenshots = [
    {
        "file": os.path.join(SCREENSHOTS_DIR, "coa_overview_spacetime_studio.png"),
        "url": f"file:///{INDEX_HTML.replace('\\', '/')}?preset=raw_forwarding&step=8",
        "size": "--window-size=1400,900"
    },
    {
        "file": os.path.join(SCREENSHOTS_DIR, "coa_datapath_schematic.png"),
        "url": f"file:///{INDEX_HTML.replace('\\', '/')}?tab=tab-schematic&preset=raw_forwarding&step=4",
        "size": "--window-size=1400,850"
    },
    {
        "file": os.path.join(SCREENSHOTS_DIR, "coa_amdahl_performance_lab.png"),
        "url": f"file:///{INDEX_HTML.replace('\\', '/')}?tab=tab-amdahl",
        "size": "--window-size=1400,850"
    },
    {
        "file": os.path.join(SCREENSHOTS_DIR, "coa_load_use_hazard.png"),
        "url": f"file:///{INDEX_HTML.replace('\\', '/')}?preset=load_use&step=6",
        "size": "--window-size=1400,900"
    },
    {
        "file": os.path.join(SCREENSHOTS_DIR, "coa_automated_test_suite.png"),
        "url": f"file:///{INDEX_HTML.replace('\\', '/')}?tab=tab-tests&runtests=true",
        "size": "--window-size=1400,850"
    }
]

print(">>> [1/2] Capturing High-Resolution Application Screenshots...")
for sc in screenshots:
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        sc["size"],
        f"--screenshot={sc['file']}",
        sc["url"]
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(sc['file']):
        print(f"  [OK] Captured: {os.path.basename(sc['file'])} ({os.path.getsize(sc['file'])} bytes)")
    else:
        print(f"  [FAIL] Failed: {os.path.basename(sc['file'])}")

print("\nScreenshot capture process complete.")

print(">>> [2/2] Generating PDF Project Report via Headless Chromium...")
pdf_cmd = [
    CHROME_PATH,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={REPORT_PDF}",
    f"file:///{REPORT_HTML.replace('\\', '/')}"
]
res_pdf = subprocess.run(pdf_cmd, capture_output=True, text=True)

if os.path.exists(REPORT_PDF) and os.path.getsize(REPORT_PDF) > 1000:
    print(f"  [OK] Generated Report PDF: {os.path.basename(REPORT_PDF)} ({os.path.getsize(REPORT_PDF)} bytes)")
else:
    print(f"  [FAIL] PDF generation failed or empty. Error: {res_pdf.stderr}")

