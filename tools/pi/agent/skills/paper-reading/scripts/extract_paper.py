#!/usr/bin/env python3
"""
Extract paper information from arXiv URL or PDF file.

Usage:
  python3 extract_paper.py --arxiv https://arxiv.org/abs/XXXX.XXXXX --output-dir /path/to/output
  python3 extract_paper.py --pdf /path/to/paper.pdf --output-dir /path/to/output
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

ARXIV_API_BASE = "http://export.arxiv.org/api/query?id_list="


def sanitize_filename(title):
    """Convert title to a filesystem-safe name."""
    # Remove or replace problematic characters
    name = re.sub(r'[^\w\s-]', '', title)
    name = re.sub(r'[-\s]+', '-', name.strip())
    name = name[:120]  # Limit length
    return name


def fetch_arxiv_metadata(arxiv_id):
    """Fetch paper metadata from arXiv API."""
    url = ARXIV_API_BASE + arxiv_id
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    response = urllib.request.urlopen(req)
    xml_data = response.read().decode("utf-8")

    # Parse XML
    root = ET.fromstring(xml_data)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "arxiv": "http://arxiv.org/schemas/atom",
    }

    entry = root.find("atom:entry", ns)
    if entry is None:
        raise ValueError("Could not find paper entry in arXiv response")

    title = entry.find("atom:title", ns)
    title = title.text.strip().replace("\n", " ") if title is not None else "Unknown Title"

    summary = entry.find("atom:summary", ns)
    summary = summary.text.strip().replace("\n", " ") if summary is not None else ""

    authors = []
    for author in entry.findall("atom:author", ns):
        name = author.find("atom:name", ns)
        if name is not None:
            authors.append(name.text.strip())

    published = entry.find("atom:published", ns)
    published = published.text[:4] if published is not None else ""

    links = {}
    for link in entry.findall("atom:link", ns):
        links[link.get("title", "")] = link.get("href", "")

    pdf_url = links.get("pdf", "")
    abs_url = links.get("abstract", f"https://arxiv.org/abs/{arxiv_id}")

    # Try to get comment info (conference/journal)
    comment = entry.find("arxiv:comment", ns)
    comment_text = comment.text.strip() if comment is not None else ""

    # Try to get categories/primary category
    primary_cat = entry.find("arxiv:primary_category", ns)
    category = primary_cat.get("term", "") if primary_cat is not None else ""

    return {
        "title": title,
        "title_sanitized": sanitize_filename(title),
        "authors": authors,
        "abstract": summary,
        "year": published,
        "pdf_url": pdf_url,
        "abs_url": abs_url,
        "comment": comment_text,
        "category": category,
        "arxiv_id": arxiv_id,
    }


def download_pdf(url, output_path):
    """Download PDF from URL."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    response = urllib.request.urlopen(req)
    with open(output_path, "wb") as f:
        f.write(response.read())
    return output_path


def extract_text_from_pdf(pdf_path, output_path):
    """Extract text from PDF using pdftotext."""
    result = subprocess.run(
        ["pdftotext", "-layout", pdf_path, output_path],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"pdftotext failed: {result.stderr}")
    return output_path


def guess_title_from_pdf_text(text):
    """Try to guess the paper title from the first page of text."""
    lines = text.strip().split("\n")
    # Look for a line that looks like a title (not too short, not too long,
    # typically at the top of the page)
    candidates = []
    for line in lines[:50]:  # Check first 50 lines
        line = line.strip()
        # Skip empty lines, page numbers, arXiv IDs, and very short lines
        if not line or len(line) < 10:
            continue
        if re.match(r'^[\d\s\-—.]*$', line):
            continue
        if re.match(r'^(arXiv|v\d|http)', line, re.IGNORECASE):
            continue
        candidates.append(line)

    # The first content line that's a reasonable title length is likely the title
    for c in candidates:
        if 15 <= len(c) <= 200 and c[0].isupper():
            return c
    return candidates[0] if candidates else None


def get_pdf_metadata_title(pdf_path):
    """Try to get title from PDF metadata using pdftotext raw dump or similar."""
    result = subprocess.run(
        ["pdftotext", "-meta", pdf_path, "-"],
        capture_output=True, text=True
    )
    output = result.stdout
    # Look for Title in metadata
    match = re.search(r'Title:\s*(.+)', output)
    if match:
        return match.group(1).strip()
    return None


def extract_arxiv_id_from_url(url):
    """Extract arXiv ID from URL."""
    # Handle various URL formats:
    # https://arxiv.org/abs/XXXX.XXXXX
    # https://arxiv.org/pdf/XXXX.XXXXX.pdf
    # https://arxiv.org/abs/XXXX.XXXXXv1
    # http://arxiv.org/abs/XXXX.XXXXX
    match = re.search(r'arxiv\.org/(?:abs|pdf)/([\d]+\.[\d]+)', url)
    if match:
        return match.group(1)
    return None


def extract_arxiv_id_from_text(text):
    """Try to find an arXiv ID in the text."""
    match = re.search(r'arxiv:\s*([\d]+\.[\d]+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r'([\d]{4}\.[\d]+)', text)
    if match:
        return match.group(1)
    return None


def main():
    parser = argparse.ArgumentParser(description="Extract paper information")
    parser.add_argument("--arxiv", help="arXiv URL")
    parser.add_argument("--pdf", help="Path to PDF file")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    args = parser.parse_args()

    if not args.arxiv and not args.pdf:
        print("ERROR: Must provide either --arxiv or --pdf", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    metadata = None
    pdf_path = None

    if args.arxiv:
        arxiv_id = extract_arxiv_id_from_url(args.arxiv)
        if not arxiv_id:
            print(f"ERROR: Could not extract arXiv ID from URL: {args.arxiv}", file=sys.stderr)
            sys.exit(1)

        print(f"Fetching metadata from arXiv API (ID: {arxiv_id})...")
        metadata = fetch_arxiv_metadata(arxiv_id)

        # Save metadata
        meta_path = os.path.join(args.output_dir, "paper_metadata.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"Metadata saved to: {meta_path}")

        # Download PDF
        if metadata["pdf_url"]:
            pdf_path = os.path.join(args.output_dir, "paper.pdf")
            print(f"Downloading PDF from {metadata['pdf_url']}...")
            download_pdf(metadata["pdf_url"], pdf_path)
            print(f"PDF saved to: {pdf_path}")
        else:
            print("WARNING: No PDF URL found in arXiv metadata", file=sys.stderr)

    elif args.pdf:
        pdf_path = args.pdf
        if not os.path.isfile(pdf_path):
            print(f"ERROR: PDF file not found: {pdf_path}", file=sys.stderr)
            sys.exit(1)

        # Try to extract metadata
        title = get_pdf_metadata_title(pdf_path)
        title_sanitized = None

        # If no title from metadata, extract text first to guess
        txt_path = os.path.join(args.output_dir, "paper_text.txt")
        print(f"Extracting text from PDF: {pdf_path}")
        extract_text_from_pdf(pdf_path, txt_path)

        with open(txt_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        if not title:
            title = guess_title_from_pdf_text(full_text)
            print(f"Guessed title from first page: {title}")

        # Try to find arXiv ID in text
        arxiv_id = extract_arxiv_id_from_text(full_text)

        metadata = {
            "title": title or "Unknown Title",
            "title_sanitized": sanitize_filename(title) if title else "unknown-paper",
            "authors": [],
            "abstract": "",
            "year": "",
            "pdf_url": "",
            "abs_url": "",
            "comment": "",
            "category": "",
            "arxiv_id": arxiv_id or "",
            "source": pdf_path,
        }

        meta_path = os.path.join(args.output_dir, "paper_metadata.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"Metadata saved to: {meta_path}")

    # Extract full text from PDF
    if pdf_path:
        txt_path = os.path.join(args.output_dir, "paper_text.txt")
        print(f"Extracting full text to: {txt_path}")
        extract_text_from_pdf(pdf_path, txt_path)

        # Report stats
        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read()
        lines = text.count("\n") + 1
        words = len(text.split())
        print(f"Extracted {lines} lines, ~{words} words")

    # Print summary info
    print(f"\n===== Paper Summary =====")
    print(f"Title: {metadata['title']}")
    if metadata.get('authors'):
        authors_str = ", ".join(metadata['authors'][:5])
        if len(metadata['authors']) > 5:
            authors_str += f" et al. ({len(metadata['authors'])} authors)"
        print(f"Authors: {authors_str}")
    if metadata.get('year'):
        print(f"Year: {metadata['year']}")
    if metadata.get('category'):
        print(f"Category: {metadata['category']}")
    if metadata.get('arxiv_id'):
        print(f"arXiv ID: {metadata['arxiv_id']}")
    print(f"Output directory: {args.output_dir}")
    print(f"=========================")


if __name__ == "__main__":
    main()
