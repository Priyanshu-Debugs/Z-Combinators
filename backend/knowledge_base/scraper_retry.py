"""
Retry scraper for articles that failed with 404 in the first pass.
Uses corrected URLs discovered via web search.
"""

import os
import re
import sys
import time
import urllib.request
from bs4 import BeautifulSoup

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SOURCES_DIR = os.path.join(os.path.dirname(__file__), "sources")
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def clean_text(text: str) -> str:
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def scrape_url(url: str, parser_fn) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "aside"]):
                tag.decompose()
            return parser_fn(soup)
    except Exception as e:
        print(f"  [ERROR] Failed to fetch {url}: {e}")
        return ""


def parse_generic(soup: BeautifulSoup) -> str:
    """Generic parser — try common content containers."""
    for selector in [
        ("article", {}),
        ("div", {"class": "post-content"}),
        ("div", {"class": "entry-content"}),
        ("div", {"class": "body markup"}),
        ("div", {"class": "content"}),
        ("main", {}),
    ]:
        tag, attrs = selector
        el = soup.find(tag, attrs) if attrs else soup.find(tag)
        if el and len(el.get_text()) > 300:
            return clean_text(el.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_nfx(soup: BeautifulSoup) -> str:
    content = (
        soup.find("div", class_="post-content")
        or soup.find("article")
        or soup.find("div", class_="content")
        or soup.find("main")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_eladgil(soup: BeautifulSoup) -> str:
    content = (
        soup.find("article")
        or soup.find("div", class_="post-content")
        or soup.find("div", class_="entry-content")
        or soup.find("main")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_andrewchen(soup: BeautifulSoup) -> str:
    content = (
        soup.find("article")
        or soup.find("div", class_="post-content")
        or soup.find("div", class_="entry-content")
        or soup.find("div", class_="body")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_firstround(soup: BeautifulSoup) -> str:
    content = (
        soup.find("article")
        or soup.find("div", class_="post-content")
        or soup.find("div", class_="article-body")
        or soup.find("div", class_="entry-content")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


# Corrected URLs for failed articles
RETRY_TARGETS = [
    # --- Andrew Chen (corrected URL) ---
    {
        "filename": "chen_when_startup_has_pmf.txt",
        "url": "https://andrewchen.com/when-has-a-consumer-startup-hit-productmarket-fit/",
        "parser": parse_andrewchen,
        "title": "When Has a Consumer Startup Hit Product/Market Fit?",
        "author": "Andrew Chen (a16z)",
    },
    {
        "filename": "chen_cold_start_problem.txt",
        "url": "https://andrewchen.com/the-cold-start-problem-how-to-start-and-scale-network-effects-excerpt/",
        "parser": parse_andrewchen,
        "title": "The Cold Start Problem: How to Start and Scale Network Effects",
        "author": "Andrew Chen (a16z)",
    },
    {
        "filename": "chen_distribution_pmf.txt",
        "url": "https://andrewchen.com/dual-theories-on-distribution-and-product-market-fit/",
        "parser": parse_andrewchen,
        "title": "Startups Need Dual Theories on Distribution and Product/Market Fit",
        "author": "Andrew Chen (a16z)",
    },
    # --- NFX (corrected slugs) ---
    {
        "filename": "nfx_timing_is_everything.txt",
        "url": "https://www.nfx.com/post/why-startup-timing-is-everything",
        "parser": parse_nfx,
        "title": "Why Startup Timing is Everything",
        "author": "NFX (James Currier)",
    },
    {
        "filename": "nfx_19_tactics_chicken_egg.txt",
        "url": "https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem",
        "parser": parse_nfx,
        "title": "19 Tactics to Solve the Chicken-or-Egg Problem and Grow Your Marketplace",
        "author": "NFX",
    },
    {
        "filename": "nfx_marketplace_scorecard.txt",
        "url": "https://www.nfx.com/post/marketplace-scorecard-see-your-score",
        "parser": parse_nfx,
        "title": "The NFX Marketplace Scorecard",
        "author": "NFX",
    },
    # --- Elad Gil (corrected URLs — eladgil.com not blog.eladgil.com) ---
    {
        "filename": "eladgil_defensibility_competition.txt",
        "url": "https://eladgil.com/defensibility-competition",
        "parser": parse_eladgil,
        "title": "Defensibility & Competition",
        "author": "Elad Gil",
    },
    {
        "filename": "eladgil_hiring_executives.txt",
        "url": "https://eladgil.com/6-traits-to-look-for-when-hiring-executives",
        "parser": parse_eladgil,
        "title": "6 Traits To Look For When Hiring Executives",
        "author": "Elad Gil",
    },
    # --- First Round Review (corrected / new URLs) ---
    {
        "filename": "firstround_cofounder_dating.txt",
        "url": "https://review.firstround.com/the-founder-dating-playbook-heres-the-process-i-used-to-find-my-co-founder/",
        "parser": parse_firstround,
        "title": "The Founder Dating Playbook: Here's the Process I Used to Find My Co-Founder",
        "author": "First Round Review / Gloria Lin",
    },
    {
        "filename": "firstround_fundraising_pitch.txt",
        "url": "https://review.firstround.com/take-your-fundraising-pitch-from-mediocre-to-memorable/",
        "parser": parse_firstround,
        "title": "Take Your Fundraising Pitch from Mediocre to Memorable",
        "author": "First Round Review",
    },
]


def run_retry():
    os.makedirs(SOURCES_DIR, exist_ok=True)
    print("=" * 60)
    print("RETRY SCRAPING — Corrected URLs for Failed Articles")
    print("=" * 60)

    total_scraped = 0
    total_bytes = 0

    for item in RETRY_TARGETS:
        filepath = os.path.join(SOURCES_DIR, item["filename"])

        if os.path.exists(filepath) and os.path.getsize(filepath) > 500:
            print(f"\n[SKIP] {item['filename']} already exists")
            continue

        print(f"\n[Scraping] {item['title']}")
        print(f"  URL: {item['url']}")
        text = scrape_url(item["url"], item["parser"])

        if len(text) > 300:
            header = f"# {item['title']}\n# Author: {item['author']}\n# Source: {item['url']}\n\n"
            content = header + text

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

            size = len(content.encode("utf-8"))
            print(f"  [OK] Saved to {item['filename']} ({size:,} bytes, {len(content.split())} words)")
            total_scraped += 1
            total_bytes += size
        else:
            print(f"  ⚠ Scraped content too short ({len(text)} chars). Skipped.")

        time.sleep(1.5)

    print(f"\nRETRY COMPLETE: {total_scraped} additional articles scraped ({total_bytes:,} bytes)")


if __name__ == "__main__":
    run_retry()
