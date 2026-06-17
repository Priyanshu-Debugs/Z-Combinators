"""
Scraper for startup framework essays.

Reads a sources.json file and fetches each URL, extracting the main text
content. Outputs plain text files into the sources/ directory.

This is an offline, run-once tool. Not imported by the runtime server.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def extract_main_content(soup: BeautifulSoup) -> str:
    """Extract the main text content from a parsed HTML page."""
    # Remove script, style, nav, header, footer elements
    for tag in soup.find_all(
        ["script", "style", "nav", "header", "footer", "aside"]
    ):
        tag.decompose()

    # Try to find the main content container
    main = soup.find("article") or soup.find("main")
    if main:
        text = main.get_text(separator="\n", strip=True)
    else:
        # Fall back to body, or largest div by text length
        body = soup.find("body")
        if body:
            divs = body.find_all("div")
            if divs:
                main = max(divs, key=lambda d: len(d.get_text()))
                text = main.get_text(separator="\n", strip=True)
            else:
                text = body.get_text(separator="\n", strip=True)
        else:
            text = soup.get_text(separator="\n", strip=True)

    # Normalize whitespace: collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def scrape_sources(sources_file: str, output_dir: str):
    """
    Scrape all URLs listed in sources.json and save as text files.

    Args:
        sources_file: Path to the JSON file with source URLs.
        output_dir: Directory to save extracted text files.
    """
    with open(sources_file, "r", encoding="utf-8") as f:
        sources = json.load(f)

    os.makedirs(output_dir, exist_ok=True)

    success_count = 0
    fail_count = 0

    for i, source in enumerate(sources):
        url = source["url"]
        title = source["title"]
        org = source["source_org"]

        print(f"[{i + 1}/{len(sources)}] Scraping: {title}")
        print(f"  URL: {url}")

        try:
            resp = requests.get(
                url,
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            text = extract_main_content(soup)

            if len(text) < 100:
                print(f"  WARNING: Extracted text is very short ({len(text)} chars)")

            # Create filename from org and title
            slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
            filename = f"{org}_{slug}.txt"
            filepath = os.path.join(output_dir, filename)

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)

            print(f"  Saved: {filename} ({len(text)} chars)")
            success_count += 1

            # Be polite: wait between requests
            time.sleep(2)

        except Exception as e:
            print(f"  FAILED: {e}")
            fail_count += 1

    print(f"\nDone. Scraped {success_count} sources, {fail_count} failed.")


if __name__ == "__main__":
    scrape_sources(
        sources_file=os.path.join(os.path.dirname(__file__), "sources.json"),
        output_dir=os.path.join(os.path.dirname(__file__), "sources"),
    )
