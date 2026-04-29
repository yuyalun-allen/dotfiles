---
name: llm-wiki
description: "Use this skill whenever the user wants to work with their LLM Wiki knowledge base. This includes: searching or retrieving content from the wiki; reading, viewing, or browsing wiki pages; creating new wiki pages (entities, concepts, sources, synthesis); editing or updating existing pages; ingesting new sources; querying the wiki for information; performing health checks (lint); updating the index and logs; or checking wiki statistics. The wiki is located at ~/Documents/wiki/ by default. Trigger when user mentions 'wiki', 'knowledge base', or references wiki operations like 'add a source', 'search my wiki', 'create a page', 'what does my wiki say about...', etc."
license: Proprietary. LICENSE.txt has complete terms
---

# LLM Wiki Operations Guide

## Overview

This skill provides operations for working with the LLM Wiki knowledge base located at `~/Documents/wiki/`. The wiki is a persistent, LLM-maintained collection of Markdown files that accumulates knowledge over time.

## Wiki Structure

```
~/Documents/wiki/
├── AGENTS.md              # Configuration file
├── README.md              # User guide
├── index.md               # Content index
├── log.md                 # Operation log
├── raw/                   # Raw source documents
│   └── assets/            # Images and attachments
├── templates/             # Page templates
│   ├── entity-template.md
│   ├── concept-template.md
│   ├── source-template.md
│   └── synthesis-template.md
├── tools/                 # Utility scripts
│   ├── search.sh
│   └── stats.sh
└── wiki/                  # Wiki content
    ├── entities/          # Entity pages (people, orgs, places)
    ├── concepts/          # Concept pages (theories, methods)
    ├── sources/           # Source summaries
    └── synthesis/         # Synthesis pages
```

## Quick Start

### Search Wiki Content
```bash
cd ~/Documents/wiki
./tools/search.sh "keyword"
```

### View Wiki Statistics
```bash
cd ~/Documents/wiki
./tools/stats.sh
```

### Browse Index
```bash
cat ~/Documents/wiki/index.md
```

## Core Operations

### 1. Search/Retrieve Content

#### Using grep (Quick Search)
```bash
# Search for keyword in all wiki pages
grep -rn "keyword" ~/Documents/wiki/wiki/

# Search in specific category
grep -rn "keyword" ~/Documents/wiki/wiki/entities/
grep -rn "keyword" ~/Documents/wiki/wiki/concepts/

# Case-insensitive search
grep -rni "keyword" ~/Documents/wiki/

# Show only filenames
grep -rl "keyword" ~/Documents/wiki/wiki/
```

#### Using the Search Tool
```bash
cd ~/Documents/wiki
./tools/search.sh "keyword"
```

#### Reading Specific Pages
```bash
# Read a specific page
cat ~/Documents/wiki/wiki/entities/entity-name.md

# Read with line numbers
cat -n ~/Documents/wiki/wiki/concepts/concept-name.md

# Read first 50 lines
head -50 ~/Documents/wiki/wiki/sources/source-name.md
```

#### Using Python for Advanced Search
```python
import os
import re

WIKI_DIR = os.path.expanduser("~/Documents/wiki")

def search_wiki(query, category=None):
    """Search wiki for query string."""
    results = []
    search_dir = os.path.join(WIKI_DIR, "wiki", category) if category else os.path.join(WIKI_DIR, "wiki")
    
    for root, dirs, files in os.walk(search_dir):
        for file in files:
            if file.endswith(".md"):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if query.lower() in content.lower():
                            rel_path = os.path.relpath(filepath, WIKI_DIR)
                            results.append(rel_path)
                except Exception as e:
                    pass
    return results

# Example usage
matches = search_wiki("machine learning")
print(f"Found {len(matches)} pages")
for m in matches[:10]:
    print(f"  - {m}")
```

### 2. View/Read Pages

#### Read Full Page
```python
def read_page(page_path):
    """Read a wiki page by name or path."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    # Try different categories if not a full path
    if not page_path.startswith('/'):
        categories = ['entities', 'concepts', 'sources', 'synthesis', '']
        for cat in categories:
            if cat:
                filepath = os.path.join(WIKI_DIR, "wiki", cat, f"{page_path}.md")
            else:
                filepath = os.path.join(WIKI_DIR, f"{page_path}.md")
            
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    return f.read()
    
    # Try direct path
    if os.path.exists(page_path):
        with open(page_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    return None

# Usage
content = read_page("andrej-karpathy")
if content:
    print(content[:500])  # First 500 chars
```

#### Read Page Metadata (Frontmatter)
```python
import yaml

def read_page_metadata(page_path):
    """Extract frontmatter metadata from a wiki page."""
    content = read_page(page_path)
    if not content:
        return None
    
    # Parse frontmatter
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 2:
            try:
                metadata = yaml.safe_load(parts[1])
                return metadata
            except:
                pass
    return {}

# Usage
meta = read_page_metadata("llm-wiki-pattern")
print(f"Type: {meta.get('type')}")
print(f"Sources: {meta.get('sources', [])}")
print(f"Related: {meta.get('related', [])}")
```

#### List Pages by Category
```python
def list_pages(category=None):
    """List all pages in a category."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    if category:
        dir_path = os.path.join(WIKI_DIR, "wiki", category)
    else:
        dir_path = os.path.join(WIKI_DIR, "wiki")
    
    pages = []
    if os.path.exists(dir_path):
        for root, dirs, files in os.walk(dir_path):
            for file in files:
                if file.endswith('.md'):
                    rel_path = os.path.relpath(os.path.join(root, file), dir_path)
                    pages.append(rel_path)
    
    return sorted(pages)

# Usage
print("Entities:", list_pages("entities"))
print("Concepts:", list_pages("concepts"))
```

### 3. Create New Pages

#### Create Entity Page
```python
def create_entity(name, category="person", summary="", sources=None, related=None):
    """Create a new entity page."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    filepath = os.path.join(WIKI_DIR, "wiki", "entities", f"{name}.md")
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    sources_list = sources or []
    related_list = related or []
    
    content = f"""---
type: entity
category: {category}
created: {today}
sources: [{', '.join(sources_list)}]
related: [{', '.join(related_list)}]
---

# {name.replace('-', ' ').title()}

## 📋 Overview

{summary}

## 📖 Details

### Basic Information
- **Type**: {category}
- **Related Fields**: 

### Background
*Detailed description*

## 🔗 Relations

### Related Concepts
- [[concept-name]] - brief description

### Related Entities
- [[entity-name]] - brief description

## 📚 Sources

"""
    
    for src in sources_list:
        content += f"- [[{src}]] - reference or summary\n"
    
    content += f"""
## 📝 Notes

*Additional noteworthyable information*

---
*Page created: {today} | Last updated: {today}*
"""
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Log the creation
    log_operation("create", "entity", name)
    
    return filepath
```

#### Create Concept Page
```python
def create_concept(name, category="theory", summary="", definition="", sources=None, related=None):
    """Create a new concept page."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    filepath = os.path.join(WIKI_DIR, "wiki", "concepts", f"{name}.md")
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    sources_list = sources or []
    related_list = related or []
    
    content = f"""---
type: concept
category: {category}
created: {today}
sources: [{', '.join(sources_list)}]
related: [{', '.join(related_list)}]
---

# {name.replace('-', ' ').title()}

## 📋 Overview

{summary}

## 📖 Explanation

### Definition
{definition}

### Origin & Development
*History and development of this concept*

### Key Characteristics
- Characteristic 1
- Characteristic 2

## 🔗 Relations

### Related Concepts
- [[related-concept]] - relationship description

### Related Entities
- [[entity-name]] - relationship description

## 💡 Applications

*Practical application examples*

## 📚 Sources

"""
    
    for src in sources_list:
        content += f"- [[{src}]] - reference or summary\n"
    
    content += f"""
## 📝 Notes

*Additional notes or questions for further research*

---
*Page created: {today} | Last updated: {today}*
"""
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    log_operation("create", "concept", name)
    
    return filepath
```

#### Create Source Summary
```python
def create_source_summary(filename, title, source_type="article", author="", date="", url="", tags=None, core_points=None, summary=""):
    """Create a source summary page."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    filepath = os.path.join(WIKI_DIR, "wiki", "sources", f"{filename}.md")
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    tags_list = tags or []
    points_list = core_points or []
    
    content = f"""---
type: source
source-type: {source_type}
author: {author}
date: {date}
ingested: {today}
url: {url}
tags: [{', '.join(tags_list)}]
---

# {title}

## 📋 Metadata

- **Type**: {source_type}
- **Author**: {author}
- **Date**: {date}
- **Ingested**: {today}
- **URL**: {url}

## 🎯 Core Points

"""
    
    for point in points_list:
        content += f"- {point}\n"
    
    content += f"""
## 📝 Detailed Summary

{summary}

## 🔗 Extracted Entities & Concepts

### New Entities
- [[entity-name]] - description

### New Concepts
- [[concept-name]] - description

## 💭 Thoughts & Discussion

### Connections to Other Sources
*How this relates to other known information*

### Contradictions or Questions
*Any content needing verification*

### Follow-up Actions
- [ ] Topics to research further
- [ ] Questions to explore

## 📚 Citation

```
{author}. ({date}). {title}. 
```

---
*Summary created: {today} | Last updated: {today}*
"""
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    log_operation("ingest", "source", filename)
    
    return filepath
```

#### Create Synthesis Page
```python
def create_synthesis(topic, title, question="", conclusion="", sections=None, sources=None, related=None):
    """Create a synthesis/analysis page."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    filepath = os.path.join(WIKI_DIR, "wiki", "synthesis", f"{topic}.md")
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    sources_list = sources or []
    related_list = related or []
    sections_list = sections or []
    
    content = f"""---
type: synthesis
topic: {topic}
created: {today}
updated: {today}
sources: [{', '.join(sources_list)}]
related: [{', '.join(related_list)}]
---

# {title}

## 📋 Question/Topic Overview

{question}

## 🎯 Core Conclusions

{conclusion}

## 📊 Analysis

"""
    
    for section in sections_list:
        content += f"### {section['title']}\n\n{section['content']}\n\n"
    
    content += f"""
## 🔗 References

### Entities
"""
    for entity in related_list:
        content += f"- [[{entity}]]\n"
    
    content += """
### Concepts
"""
    for concept in related_list:
        content += f"- [[{concept}]]\n"
    
    content += """
### Sources
"""
    for src in sources_list:
        content += f"- [[{src}]]\n"
    
    content += f"""
## ❓ Open Questions

*Questions for further research*

## 📝 Notes

---
*Page created: {today} | Last updated: {today}*
"""
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    log_operation("create", "synthesis", topic)
    
    return filepath
```

### 4. Edit/Update Pages

#### Update Existing Page
```python
def update_page(page_name, updates, section=None):
    """
    Update content in an existing page.
    
    Args:
        page_name: Name of the page (without .md)
        updates: Dict of section -> new content, or full content if section is None
        section: Specific section to update, or None for full replacement
    """
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    # Find the page
    page_path = None
    for category in ['entities', 'concepts', 'sources', 'synthesis', '']:
        if category:
            test_path = os.path.join(WIKI_DIR, "wiki", category, f"{page_name}.md")
        else:
            test_path = os.path.join(WIKI_DIR, f"{page_name}.md")
        
        if os.path.exists(test_path):
            page_path = test_path
            break
    
    if not page_path:
        return None
    
    with open(page_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if section:
        # Update specific section
        # This is simplified - in practice, you'd parse the markdown structure
        import re
        pattern = f"(## {section}\\n\\n)(.*?)(?=\\n## |\\n---|$)"
        replacement = f"\\1{updates}\\n"
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    else:
        # Full content replacement (preserve frontmatter)
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                content = f"---{parts[1]}---\n{updates}"
        else:
            content = updates
    
    with open(page_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Update timestamp in frontmatter
    update_frontmatter_timestamp(page_path)
    
    return page_path
```

#### Add Cross-Reference
```python
def add_cross_reference(page_name, reference_name, section="Relations"):
    """Add a wiki link reference to a page."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    # Find the page
    page_path = None
    for category in ['entities', 'concepts', 'sources', 'synthesis', '']:
        if category:
            test_path = os.path.join(WIKI_DIR, "wiki", category, f"{page_name}.md")
        else:
            test_path = os.path.join(WIKI_DIR, f"{page_name}.md")
        
        if os.path.exists(test_path):
            page_path = test_path
            break
    
    if not page_path:
        return False
    
    with open(page_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the section and add reference
    import re
    pattern = f"(## 🔗.*?\\n)(.*?)(?=\\n## |\\n---|$)"
    
    def add_ref(match):
        section_header = match.group(1)
        section_content = match.group(2)
        new_ref = f"- [[{reference_name}]]\n"
        return f"{section_header}{section_content}{new_ref}"
    
    content = re.sub(pattern, add_ref, content, flags=re.DOTALL)
    
    with open(page_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True
```

#### Update Frontmatter
```python
def update_frontmatter(page_name, metadata):
    """Update frontmatter metadata for a page."""
    import yaml
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    # Find the page
    page_path = None
    for category in ['entities', 'concepts', 'sources', 'synthesis', '']:
        if category:
            test_path = os.path.join(WIKI_DIR, "wiki", category, f"{page_name}.md")
        else:
            test_path = os.path.join(WIKI_DIR, f"{page_name}.md")
        
        if os.path.exists(test_path):
            page_path = test_path
            break
    
    if not page_path:
        return False
    
    with open(page_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse and update frontmatter
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            try:
                existing_meta = yaml.safe_load(parts[1])
                existing_meta.update(metadata)
                new_frontmatter = yaml.dump(existing_meta, default_flow_style=False, allow_unicode=True)
                content = f"---\n{new_frontmatter}---\n{parts[2]}"
                
                with open(page_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return True
            except Exception as e:
                print(f"Error updating frontmatter: {e}")
    
    return False
```

### 5. Update Index and Logs

#### Update Index
```python
def update_index(page_name, page_type, summary, category=None):
    """Add or update an entry in the index."""
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    index_path = os.path.join(WIKI_DIR, "index.md")
    
    if not os.path.exists(index_path):
        return False
    
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create new entry
    entry = f"| [[{page_name}]] | {page_type} | {summary} | 1 |"
    
    # Find the right section and add entry
    import re
    
    section_map = {
        'entity': '## 📁 Entities',
        'concept': '## 💡 Concepts',
        'source': '## 📚 Sources',
        'synthesis': '## 🔬 Synthesis'
    }
    
    section = section_map.get(page_type, '## 📁 Entities')
    
    # Find section and add entry after header
    lines = content.split('\n')
    new_lines = []
    added = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        if line.startswith(section) and not added:
            # Find the table and add entry
            # Skip header row and separator
            if i + 2 < len(lines) and '|---' in lines[i + 2]:
                new_lines.append(entry)
                added = True
    
    if added:
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        
        # Update timestamp
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        content = content.replace("**Last updated**: .*", f"**Last updated**: {today}")
        
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return added
```

#### Log Operation
```python
def log_operation(operation, item_type, item_name, details=None):
    """Log an operation to log.md."""
    from datetime import datetime
    
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    log_path = os.path.join(WIKI_DIR, "log.md")
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    entry = f"\n## [{today}] {operation} | {item_name}\n\n"
    
    if operation == "ingest":
        entry += f"- Type: {item_type}\n"
        entry += f"- File: `raw/{item_name}.md`\n"
    elif operation == "create":
        entry += f"- Created {item_type}: [[{item_name}]]\n"
    elif operation == "update":
        entry += f"- Updated {item_type}: [[{item_name}]]\n"
    elif operation == "query":
        entry += f"- Question: {details or 'General query'}\n"
    elif operation == "lint":
        entry += f"- Health check performed\n"
        if details:
            entry += f"- Findings: {details}\n"
    
    entry += "\n---\n"
    
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(entry)
```

#### Update Index Timestamp
```python
def update_frontmatter_timestamp(page_path):
    """Update the 'last updated' timestamp in a page's frontmatter."""
    from datetime import datetime
    import yaml
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    with open(page_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            try:
                meta = yaml.safe_load(parts[1])
                meta['updated'] = today
                new_frontmatter = yaml.dump(meta, default_flow_style=False, allow_unicode=True)
                content = f"---\n{new_frontmatter}---\n{parts[2]}"
                
                with open(page_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            except:
                pass
```

### 6. Wiki Statistics

#### Get Wiki Stats
```python
def get_wiki_stats():
    """Get statistics about the wiki."""
    import os
    from pathlib import Path
    
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    stats = {
        'entities': 0,
        'concepts': 0,
        'sources': 0,
        'synthesis': 0,
        'raw_files': 0,
        'images': 0
    }
    
    # Count pages
    for category in ['entities', 'concepts', 'sources', 'synthesis']:
        cat_dir = os.path.join(WIKI_DIR, "wiki", category)
        if os.path.exists(cat_dir):
            count = len([f for f in os.listdir(cat_dir) if f.endswith('.md')])
            stats[category] = count
    
    # Count raw files
    raw_dir = os.path.join(WIKI_DIR, "raw")
    if os.path.exists(raw_dir):
        stats['raw_files'] = len([f for f in os.listdir(raw_dir) 
                                   if os.path.isfile(os.path.join(raw_dir, f)) 
                                   and not f.startswith('.')])
        
        # Count images
        assets_dir = os.path.join(raw_dir, "assets")
        if os.path.exists(assets_dir):
            stats['images'] = len([f for f in os.listdir(assets_dir) 
                                   if os.path.isfile(os.path.join(assets_dir, f))])
    
    stats['total'] = sum([stats['entities'], stats['concepts'], stats['sources'], stats['synthesis']])
    
    return stats

# Usage
stats = get_wiki_stats()
print(f"Entities: {stats['entities']}")
print(f"Concepts: {stats['concepts']}")
print(f"Sources: {stats['sources']}")
print(f"Synthesis: {stats['synthesis']}")
print(f"Total: {stats['total']}")
```

### 7. Lint (Health Check)

#### Perform Health Check
```python
def lint_wiki():
    """Perform a health check on the wiki."""
    import os
    import re
    
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    
    issues = {
        'contradictions': [],
        'orphan_pages': [],
        'missing_references': [],
        'stale_content': [],
        'suggestions': []
    }
    
    # Collect all page names
    all_pages = set()
    for category in ['entities', 'concepts', 'sources', 'synthesis']:
        cat_dir = os.path.join(WIKI_DIR, "wiki", category)
        if os.path.exists(cat_dir):
            for f in os.listdir(cat_dir):
                if f.endswith('.md'):
                    all_pages.add(f[:-3])  # Remove .md
    
    # Check for orphan pages (pages with no inbound links)
    all_content = ""
    for category in ['entities', 'concepts', 'sources', 'synthesis']:
        cat_dir = os.path.join(WIKI_DIR, "wiki", category)
        if os.path.exists(cat_dir):
            for f in os.listdir(cat_dir):
                if f.endswith('.md'):
                    with open(os.path.join(cat_dir, f), 'r') as file:
                        all_content += file.read()
    
    # Find all wiki links
    wiki_links = set(re.findall(r'\[\[([^\]]+)\]\]', all_content))
    
    for page in all_pages:
        if page not in wiki_links and page not in ['index', 'log', 'AGENTS', 'README']:
            issues['orphan_pages'].append(page)
    
    # Check for broken links
    for link in wiki_links:
        if link not in all_pages:
            issues['missing_references'].append(link)
    
    # Check for TODO/FIXME markers
    for category in ['entities', 'concepts', 'sources', 'synthesis']:
        cat_dir = os.path.join(WIKI_DIR, "wiki", category)
        if os.path.exists(cat_dir):
            for f in os.listdir(cat_dir):
                if f.endswith('.md'):
                    with open(os.path.join(cat_dir, f), 'r') as file:
                        content = file.read()
                        if 'TODO' in content or 'FIXME' in content:
                            issues['suggestions'].append(f"{f}: Contains TODO/FIXME")
                        if '待确认' in content or '待研究' in content:
                            issues['suggestions'].append(f"{f}: Contains pending items")
    
    return issues

# Usage
issues = lint_wiki()
print(f"Orphan pages: {issues['orphan_pages']}")
print(f"Missing references: {issues['missing_references']}")
print(f"Suggestions: {issues['suggestions']}")
```

## Workflows

### Workflow: Ingest New Source

1. User adds file to `raw/` directory
2. Read and analyze the source:
   ```python
   content = read_page("raw/filename.md")
   ```
3. Extract entities, concepts, and key points
4. Create source summary:
   ```python
   create_source_summary("filename", "Title", core_points=[...], summary="...")
   ```
5. Create/update entity and concept pages
6. Update index:
   ```python
   update_index("filename", "source", "Summary")
   ```
7. Log the operation:
   ```python
   log_operation("ingest", "source", "filename")
   ```

### Workflow: Query Wiki

1. User asks a question
2. Search relevant pages:
   ```python
   results = search_wiki("keyword")
   ```
3. Read relevant pages:
   ```python
   content = read_page(page_name)
   ```
4. Synthesize answer with citations
5. Optionally save synthesis:
   ```python
   create_synthesis("topic", "Title", question="...", conclusion="...")
   ```

### Workflow: Create New Content

1. Identify content type (entity, concept, synthesis)
2. Use appropriate creation function
3. Add cross-references to related pages
4. Update index
5. Log the creation

### Workflow: Health Check

1. Run lint function:
   ```python
   issues = lint_wiki()
   ```
2. Review and address issues:
   - Add missing pages for orphan references
   - Update stale content
   - Resolve contradictions
3. Log the lint operation

## Best Practices

### File Naming
- Use `kebab-case`: `my-page-name.md`
- Lowercase only
- No spaces or special characters

### Cross-References
- Always link related pages using `[[page-name]]`
- Update related pages when creating new content
- Maintain bidirectional links when appropriate

### Frontmatter
- Always include complete frontmatter
- Keep `sources` and `related` lists current
- Update `updated` timestamp on edits

### Content Quality
- Cite sources for all claims
- Mark uncertain information with `==待确认==`
- Keep summaries concise but complete
- Use consistent formatting

### Index Maintenance
- Update index after every create/update operation
- Keep summaries accurate and helpful
- Maintain category organization

## Troubleshooting

### Page Not Found
```python
# Search across all categories
def find_page(name):
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    for root, dirs, files in os.walk(os.path.join(WIKI_DIR, "wiki")):
        for f in files:
            if f == f"{name}.md" or name in f:
                return os.path.join(root, f)
    return None
```

### Broken Links
```python
# Find pages that reference a non-existent page
def find_broken_link_references(broken_page):
    WIKI_DIR = os.path.expanduser("~/Documents/wiki")
    references = []
    
    for root, dirs, files in os.walk(os.path.join(WIKI_DIR, "wiki")):
        for f in files:
            if f.endswith('.md'):
                with open(os.path.join(root, f), 'r') as file:
                    content = file.read()
                    if f"[[{broken_page}]]" in content:
                        references.append(os.path.relpath(os.path.join(root, f), WIKI_DIR))
    
    return references
```

### Merge Conflicts
If using git and encountering merge conflicts:
1. Always backup before bulk edits
2. Edit one file at a time
3. Test changes incrementally
4. Use git diff to review changes

## Next Steps

- Regularly run health checks to maintain wiki quality
- Expand the wiki by ingesting new sources
- Create synthesis pages for complex topics
- Use the search tools to find existing content before creating duplicates
