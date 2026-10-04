"""
Automated Web Scraper for Authoritative VC & Angel Investor Literature.

Scrapes full, authentic essays, articles, and blog posts directly from
prominent VCs and Angel Investors:
- Paul Graham (paulgraham.com)
- Bill Gurley (abovethecrowd.com / Benchmark)
- Marc Andreessen (pmarchive.com / a16z)
- Sam Altman (blog.samaltman.com / Y Combinator / OpenAI)
- Fred Wilson (avc.com / Union Square Ventures)
- First Round Review (review.firstround.com / First Round Capital)
- Andrew Chen (andrewchen.com / a16z)
- Elad Gil (blog.eladgil.com)
- NFX (nfx.com)

Saves clean plaintext files into backend/knowledge_base/sources/.
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
    """Normalize whitespace and remove excessive blank lines."""
    text = re.sub(r"\r\n|\r", "\n", text)
    # Remove HTML entities and non-ascii artifacts
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def scrape_url(url: str, parser_fn) -> str:
    """Fetch URL and parse using custom parser function."""
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


# ============================================================
# PARSERS — One per source domain
# ============================================================

def parse_paulgraham(soup: BeautifulSoup) -> str:
    """Extract essay body from paulgraham.com (nested inside font/table elements)."""
    fonts = soup.find_all("font")
    longest_text = ""
    for f in fonts:
        t = f.get_text(separator="\n\n")
        if len(t) > len(longest_text):
            longest_text = t
    return clean_text(longest_text)


def parse_abovethecrowd(soup: BeautifulSoup) -> str:
    """Extract blog post from Bill Gurley's Above the Crowd."""
    entry = soup.find("div", class_="entry-content") or soup.find("div", class_="entry") or soup.find("article")
    if entry:
        return clean_text(entry.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_pmarchive(soup: BeautifulSoup) -> str:
    """Extract post from Marc Andreessen's pmarchive.com."""
    content = soup.find("div", id="content") or soup.find("body")
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_samaltman(soup: BeautifulSoup) -> str:
    """Extract post from Sam Altman's blog."""
    post = soup.find("div", class_="post") or soup.find("div", class_="entry") or soup.find("article") or soup.find("body")
    if post:
        return clean_text(post.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_avc(soup: BeautifulSoup) -> str:
    """Extract blog post from Fred Wilson's AVC.com (Union Square Ventures)."""
    entry = (
        soup.find("div", class_="entry-content")
        or soup.find("article")
        or soup.find("div", class_="post-body")
        or soup.find("div", class_="post-content")
    )
    if entry:
        return clean_text(entry.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_firstround(soup: BeautifulSoup) -> str:
    """Extract article from First Round Review (review.firstround.com)."""
    content = (
        soup.find("article")
        or soup.find("div", class_="post-content")
        or soup.find("div", class_="article-body")
        or soup.find("div", class_="entry-content")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_andrewchen(soup: BeautifulSoup) -> str:
    """Extract blog post from Andrew Chen's blog (andrewchen.com)."""
    content = (
        soup.find("article")
        or soup.find("div", class_="post-content")
        or soup.find("div", class_="entry-content")
        or soup.find("div", class_="body")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_eladgil(soup: BeautifulSoup) -> str:
    """Extract blog post from Elad Gil's blog (blog.eladgil.com / Substack)."""
    content = (
        soup.find("div", class_="body markup")
        or soup.find("div", class_="post-content")
        or soup.find("article")
        or soup.find("div", class_="entry-content")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


def parse_nfx(soup: BeautifulSoup) -> str:
    """Extract article from NFX.com."""
    content = (
        soup.find("div", class_="post-content")
        or soup.find("article")
        or soup.find("div", class_="content")
        or soup.find("main")
    )
    if content:
        return clean_text(content.get_text(separator="\n\n"))
    return clean_text(soup.get_text(separator="\n\n"))


# ============================================================
# SCRAPE TARGETS — All authentic, publicly available articles
# ============================================================

SCRAPE_TARGETS = [
    # =========================================================
    # BILL GURLEY (Benchmark) — abovethecrowd.com
    # =========================================================
    {
        "filename": "gurley_10_rules_for_marketplaces.txt",
        "url": "https://abovethecrowd.com/2012/11/13/all-markets-are-not-created-equal-10-factors-to-consider-when-evaluating-digital-marketplaces/",
        "parser": parse_abovethecrowd,
        "title": "All Markets Are Not Created Equal: 10 Factors To Consider in Evaluating Online Marketplaces",
        "author": "Bill Gurley (Benchmark)",
    },
    {
        "filename": "gurley_a_rake_too_far_take_rates.txt",
        "url": "https://abovethecrowd.com/2013/04/18/a-rake-too-far-optimal-platformpricing-strategy/",
        "parser": parse_abovethecrowd,
        "title": "A Rake Too Far: Optimal Platform Take Rates & Pricing Strategy",
        "author": "Bill Gurley (Benchmark)",
    },
    {
        "filename": "gurley_all_revenue_not_created_equal.txt",
        "url": "https://abovethecrowd.com/2011/05/24/all-revenue-is-not-created-equal-the-keys-to-the-10x-revenue-club/",
        "parser": parse_abovethecrowd,
        "title": "All Revenue is Not Created Equal: The Keys to the 10X Revenue Club",
        "author": "Bill Gurley (Benchmark)",
    },
    {
        "filename": "gurley_how_to_miss_by_a_mile.txt",
        "url": "https://abovethecrowd.com/2016/04/21/on-the-road-to-recap/",
        "parser": parse_abovethecrowd,
        "title": "On The Road to Recap: Why the Unicorn Financing Market Just Became Dangerous",
        "author": "Bill Gurley (Benchmark)",
    },
    {
        "filename": "gurley_benchmark_investing.txt",
        "url": "https://abovethecrowd.com/2014/07/11/how-to-miss-by-a-mile-an-alternative-look-at-ubers-potential-market-size/",
        "parser": parse_abovethecrowd,
        "title": "How to Miss By a Mile: An Alternative Look at Uber's Potential Market Size",
        "author": "Bill Gurley (Benchmark)",
    },

    # =========================================================
    # MARC ANDREESSEN (a16z) — pmarchive.com
    # =========================================================
    {
        "filename": "a16z_the_only_thing_that_matters.txt",
        "url": "https://pmarchive.com/guide_to_startups_part4.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 4: The Only Thing That Matters (Product/Market Fit)",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_how_to_hire_the_best_people.txt",
        "url": "https://pmarchive.com/guide_to_startups_part6.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 6: How to Hire the Best People You've Ever Worked With",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_when_vcs_say_no.txt",
        "url": "https://pmarchive.com/guide_to_startups_part2.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 2: When the VCs Say No",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_guide_part1_why_not_to_start.txt",
        "url": "https://pmarchive.com/guide_to_startups_part1.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 1: Why Not to Do a Startup",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_guide_part3_planning_fundraise.txt",
        "url": "https://pmarchive.com/guide_to_startups_part3.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 3: But I Don't Know Any VCs!",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_guide_part5_big_cos_vs_startups.txt",
        "url": "https://pmarchive.com/guide_to_startups_part5.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 5: The Moby Dick Theory of Big Companies",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_guide_part7_age_of_entrepreneur.txt",
        "url": "https://pmarchive.com/guide_to_startups_part7.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 7: Why a Startup's Initial Business Plan Doesn't Matter That Much",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },
    {
        "filename": "a16z_guide_part8_hiring_firing.txt",
        "url": "https://pmarchive.com/guide_to_startups_part8.html",
        "parser": parse_pmarchive,
        "title": "The Pmarca Guide to Startups, Part 8: Hiring, Managing, Promoting, and Firing Executives",
        "author": "Marc Andreessen (Andreessen Horowitz)",
    },

    # =========================================================
    # SAM ALTMAN (Y Combinator / OpenAI) — blog.samaltman.com
    # =========================================================
    {
        "filename": "altman_how_to_be_successful.txt",
        "url": "https://blog.samaltman.com/how-to-be-successful",
        "parser": parse_samaltman,
        "title": "How To Be Successful: 13 Principles for Outlier Trajectory",
        "author": "Sam Altman (Y Combinator / OpenAI)",
    },
    {
        "filename": "altman_idea_generation.txt",
        "url": "https://blog.samaltman.com/idea-generation",
        "parser": parse_samaltman,
        "title": "Idea Generation: Evaluating Startup Concepts & Inflection Points",
        "author": "Sam Altman (Y Combinator / OpenAI)",
    },
    {
        "filename": "altman_startup_advice.txt",
        "url": "https://blog.samaltman.com/startup-advice",
        "parser": parse_samaltman,
        "title": "Startup Advice: Execution, Focus, and Momentum",
        "author": "Sam Altman (Y Combinator / OpenAI)",
    },

    # =========================================================
    # PAUL GRAHAM (Y Combinator) — paulgraham.com
    # =========================================================
    {
        "filename": "yc_default_alive_or_dead.txt",
        "url": "http://paulgraham.com/die.html",
        "parser": parse_paulgraham,
        "title": "Default Alive or Default Dead",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_schlep_blindness.txt",
        "url": "http://paulgraham.com/schlep.html",
        "parser": parse_paulgraham,
        "title": "Schlep Blindness",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_how_to_convince_investors.txt",
        "url": "http://paulgraham.com/convince.html",
        "parser": parse_paulgraham,
        "title": "How to Convince Investors",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_startups_in_13_sentences.txt",
        "url": "http://paulgraham.com/13sentences.html",
        "parser": parse_paulgraham,
        "title": "Startups in 13 Sentences",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_relentlessly_resourceful.txt",
        "url": "http://paulgraham.com/relres.html",
        "parser": parse_paulgraham,
        "title": "Relentlessly Resourceful",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_how_to_make_wealth.txt",
        "url": "http://paulgraham.com/wealth.html",
        "parser": parse_paulgraham,
        "title": "How to Make Wealth",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_superlinear_returns.txt",
        "url": "http://paulgraham.com/superlinear.html",
        "parser": parse_paulgraham,
        "title": "Superlinear Returns",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_how_to_get_startup_ideas.txt",
        "url": "http://paulgraham.com/startupideas.html",
        "parser": parse_paulgraham,
        "title": "How to Get Startup Ideas",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_do_things_that_dont_scale.txt",
        "url": "http://paulgraham.com/ds.html",
        "parser": parse_paulgraham,
        "title": "Do Things That Don't Scale",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_startup_equals_growth.txt",
        "url": "http://paulgraham.com/growth.html",
        "parser": parse_paulgraham,
        "title": "Startup = Growth",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_before_the_startup.txt",
        "url": "http://paulgraham.com/before.html",
        "parser": parse_paulgraham,
        "title": "Before the Startup",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_how_to_raise_money.txt",
        "url": "http://paulgraham.com/fr.html",
        "parser": parse_paulgraham,
        "title": "How to Raise Money",
        "author": "Paul Graham (Y Combinator)",
    },
    # --- NEW Paul Graham essays ---
    {
        "filename": "yc_how_to_start_a_startup.txt",
        "url": "http://paulgraham.com/start.html",
        "parser": parse_paulgraham,
        "title": "How to Start a Startup",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_the_18_mistakes.txt",
        "url": "http://paulgraham.com/startupmistakes.html",
        "parser": parse_paulgraham,
        "title": "The 18 Mistakes That Kill Startups",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_mean_people_fail.txt",
        "url": "http://paulgraham.com/mean.html",
        "parser": parse_paulgraham,
        "title": "Mean People Fail",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_the_hardest_lessons.txt",
        "url": "http://paulgraham.com/startuplessons.html",
        "parser": parse_paulgraham,
        "title": "The Hardest Lessons for Startups to Learn",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_be_good.txt",
        "url": "http://paulgraham.com/good.html",
        "parser": parse_paulgraham,
        "title": "Be Good",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_ideas_for_startups.txt",
        "url": "http://paulgraham.com/ideas.html",
        "parser": parse_paulgraham,
        "title": "Ideas for Startups",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_how_to_fund_a_startup.txt",
        "url": "http://paulgraham.com/startupfunding.html",
        "parser": parse_paulgraham,
        "title": "How to Fund a Startup",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_why_startups_condense.txt",
        "url": "http://paulgraham.com/startuphubs.html",
        "parser": parse_paulgraham,
        "title": "Why Startups Condense in America",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_frighteningly_ambitious.txt",
        "url": "http://paulgraham.com/ambitious.html",
        "parser": parse_paulgraham,
        "title": "Frighteningly Ambitious Startup Ideas",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_what_startups_are_really_like.txt",
        "url": "http://paulgraham.com/really.html",
        "parser": parse_paulgraham,
        "title": "What Startups Are Really Like",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_organic_startup_ideas.txt",
        "url": "http://paulgraham.com/organic.html",
        "parser": parse_paulgraham,
        "title": "Organic Startup Ideas",
        "author": "Paul Graham (Y Combinator)",
    },
    {
        "filename": "yc_want_to_start_a_startup.txt",
        "url": "http://paulgraham.com/notnot.html",
        "parser": parse_paulgraham,
        "title": "Why to Not Not Start a Startup",
        "author": "Paul Graham (Y Combinator)",
    },

    # =========================================================
    # FRED WILSON (Union Square Ventures) — avc.com
    # =========================================================
    {
        "filename": "usv_product_market_fit.txt",
        "url": "https://avc.com/2017/02/product-market-fit/",
        "parser": parse_avc,
        "title": "Product Market Fit",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_the_valuation_trap.txt",
        "url": "https://avc.com/2016/05/the-valuation-trap/",
        "parser": parse_avc,
        "title": "The Valuation Trap",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_burn_rates_how_much.txt",
        "url": "https://avc.com/2011/12/burn-rates-how-much/",
        "parser": parse_avc,
        "title": "Burn Rates: How Much?",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_the_management_team.txt",
        "url": "https://avc.com/2012/01/the-management-team-while-building-product/",
        "parser": parse_avc,
        "title": "The Management Team: While Building Product",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_network_effects.txt",
        "url": "https://avc.com/2016/07/network-effects/",
        "parser": parse_avc,
        "title": "Network Effects",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_defensibility.txt",
        "url": "https://avc.com/2013/06/defensibility-and-competition/",
        "parser": parse_avc,
        "title": "Defensibility and Competition",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_the_startup_curve.txt",
        "url": "https://avc.com/2012/09/the-startup-curve/",
        "parser": parse_avc,
        "title": "The Startup Curve",
        "author": "Fred Wilson (Union Square Ventures)",
    },
    {
        "filename": "usv_what_to_look_for_team.txt",
        "url": "https://avc.com/2013/08/mba-mondays-what-i-look-for-in-a-founding-team/",
        "parser": parse_avc,
        "title": "What I Look For in a Founding Team",
        "author": "Fred Wilson (Union Square Ventures)",
    },

    # =========================================================
    # FIRST ROUND REVIEW — review.firstround.com
    # =========================================================
    {
        "filename": "firstround_superhuman_pmf_engine.txt",
        "url": "https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/",
        "parser": parse_firstround,
        "title": "How Superhuman Built an Engine to Find Product-Market Fit",
        "author": "First Round Review / Rahul Vohra",
    },
    {
        "filename": "firstround_mvp_testing_process.txt",
        "url": "https://review.firstround.com/the-minimum-viable-testing-process-for-evaluating-startup-ideas/",
        "parser": parse_firstround,
        "title": "The Minimum Viable Testing Process for Evaluating Startup Ideas",
        "author": "First Round Review",
    },
    {
        "filename": "firstround_pick_a_cofounder.txt",
        "url": "https://review.firstround.com/how-to-pick-a-co-founder/",
        "parser": parse_firstround,
        "title": "How to Pick a Co-Founder",
        "author": "First Round Review",
    },
    {
        "filename": "firstround_lessons_1000_pitches.txt",
        "url": "https://review.firstround.com/lessons-learned-from-1000-pitch-decks/",
        "parser": parse_firstround,
        "title": "Lessons Learned from 1,000 Pitch Decks",
        "author": "First Round Review",
    },

    # =========================================================
    # ANDREW CHEN (a16z GP) — andrewchen.com
    # =========================================================
    {
        "filename": "chen_zero_to_pmf.txt",
        "url": "https://andrewchen.com/zero-to-productmarket-fit-presentation/",
        "parser": parse_andrewchen,
        "title": "Zero to Product/Market Fit",
        "author": "Andrew Chen (a16z)",
    },
    {
        "filename": "chen_dau_mau_stickiness.txt",
        "url": "https://andrewchen.com/dau-mau-is-an-important-metric-but-heres-where-it-fails/",
        "parser": parse_andrewchen,
        "title": "DAU/MAU is an Important Metric but Here's Where it Fails",
        "author": "Andrew Chen (a16z)",
    },
    {
        "filename": "chen_cold_start_problem.txt",
        "url": "https://andrewchen.com/the-cold-start-problem-how-to-start-and-scale-network-effects/",
        "parser": parse_andrewchen,
        "title": "The Cold Start Problem: How to Start and Scale Network Effects",
        "author": "Andrew Chen (a16z)",
    },
    {
        "filename": "chen_when_startup_has_pmf.txt",
        "url": "https://andrewchen.com/when-has-a-consumer-startup-hit-product-market-fit/",
        "parser": parse_andrewchen,
        "title": "When Has a Consumer Startup Hit Product/Market Fit?",
        "author": "Andrew Chen (a16z)",
    },
    {
        "filename": "chen_new_startup_metric_retention.txt",
        "url": "https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/",
        "parser": parse_andrewchen,
        "title": "New Data Shows Why Losing 80% of Your Mobile Users is Normal",
        "author": "Andrew Chen (a16z)",
    },

    # =========================================================
    # ELAD GIL — blog.eladgil.com (Substack)
    # =========================================================
    {
        "filename": "eladgil_moats_and_defensibility.txt",
        "url": "https://blog.eladgil.com/p/moats",
        "parser": parse_eladgil,
        "title": "Moats & Defensibility",
        "author": "Elad Gil",
    },
    {
        "filename": "eladgil_how_to_hire.txt",
        "url": "https://blog.eladgil.com/p/how-to-hire",
        "parser": parse_eladgil,
        "title": "How to Hire",
        "author": "Elad Gil",
    },
    {
        "filename": "eladgil_end_of_cycle.txt",
        "url": "https://blog.eladgil.com/p/end-of-cycle",
        "parser": parse_eladgil,
        "title": "End of Cycle?",
        "author": "Elad Gil",
    },

    # =========================================================
    # NFX — nfx.com
    # =========================================================
    {
        "filename": "nfx_timing_is_everything.txt",
        "url": "https://www.nfx.com/post/timing",
        "parser": parse_nfx,
        "title": "Why Timing is Everything in Startups",
        "author": "NFX (James Currier)",
    },
    {
        "filename": "nfx_10_places_to_find_pmf.txt",
        "url": "https://www.nfx.com/post/10-places-find-product-market-fit",
        "parser": parse_nfx,
        "title": "10 Places to Find Product-Market Fit",
        "author": "NFX",
    },
    {
        "filename": "nfx_marketplace_scorecard.txt",
        "url": "https://www.nfx.com/post/marketplace-scorecard",
        "parser": parse_nfx,
        "title": "The NFX Marketplace Scorecard",
        "author": "NFX",
    },
    {
        "filename": "nfx_the_moat_map.txt",
        "url": "https://www.nfx.com/post/the-moat-map",
        "parser": parse_nfx,
        "title": "The Moat Map: A Systematic Approach to Defensibility",
        "author": "NFX",
    },
    {
        "filename": "nfx_cold_start_problem.txt",
        "url": "https://www.nfx.com/post/cold-start-problem",
        "parser": parse_nfx,
        "title": "Solving the Cold Start Problem",
        "author": "NFX",
    },
]


def run_scraper():
    """Execute scraping across all target URLs and save into sources/."""
    os.makedirs(SOURCES_DIR, exist_ok=True)
    print("=" * 60)
    print("SCRAPING REAL ARTICLES FROM PROMINENT VCS & ANGEL INVESTORS")
    print("=" * 60)

    total_scraped = 0
    total_skipped = 0
    total_bytes = 0

    for item in SCRAPE_TARGETS:
        filepath = os.path.join(SOURCES_DIR, item["filename"])

        # Skip files that already exist and have content
        if os.path.exists(filepath) and os.path.getsize(filepath) > 500:
            print(f"\n[SKIP] {item['filename']} already exists ({os.path.getsize(filepath):,} bytes)")
            total_skipped += 1
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

        time.sleep(1.5)  # Respectful rate limiting between requests

    print("\n" + "=" * 60)
    print(f"SCRAPING COMPLETE:")
    print(f"  New: {total_scraped} essays scraped ({total_bytes:,} bytes)")
    print(f"  Skipped (already exist): {total_skipped}")
    print(f"  Total targets: {len(SCRAPE_TARGETS)}")
    print("=" * 60)


if __name__ == "__main__":
    run_scraper()
