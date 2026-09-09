#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verify CV publication entries against PubMed and suggest an ABMF category.

Usage:
    python3 verify_pubs.py --author "Lastname" citations.json > report.json
    python3 verify_pubs.py --author "Lastname AB" --text citations.txt

citations.json : ["Author AB, ... Title. Journal. Year;Vol(Iss):pages.", ...]
citations.txt  : one citation per line.

Output JSON, one object per input citation:
    {index, text, pmid, score, pubmed:{...}, suggested_category, reason, flags:[...]}
plus pubmed_records_not_on_cv, the indexed records no citation claimed.

Category codes: OR RA CR BC BK ED GL LT CS CW MT OP RO PR PC WP MR OM
Only OR requires PubMed indexing. EXCLUDE marks work that is not yet published.

Flags worth reading before trusting suggested_category:
    NEAR MISS   no record cleared the match threshold, but one came close. Usually the
                CV title is wrong or truncated; check before calling the paper unindexed.
    JOURNAL     the matched record is in a journal the citation does not name. A meeting
                abstract matches its own full paper this way; the record is then left in
                pubmed_records_not_on_cv so the missing full paper is still reported.
    EXCLUDE     reads as in preparation, submitted or under review.
"""
import argparse, json, re, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

E = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
STOP = set('a an the of and in on for to with by from as at is are be it its using use uses their our new'.split())

def _get(url, tries=5):
    for _ in range(tries):
        try:
            return urllib.request.urlopen(url, timeout=60).read()
        except (urllib.error.URLError, OSError):
            time.sleep(2)
    return b''

def norm(s):
    return ' '.join(re.sub(r'[^a-z0-9 ]', ' ', s.lower()).split())

def toks(s):
    return [w for w in norm(s).split() if w not in STOP and len(w) > 2]

def shingles(ws, n=3):
    return set(tuple(ws[i:i + n]) for i in range(len(ws) - n + 1))

def parse_articles(xml):
    out = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return out
    for art in root.findall('.//PubmedArticle'):
        m = art.find('.//MedlineCitation'); a = m.find('Article')
        rec = dict(
            pmid=m.findtext('PMID'),
            title=''.join(a.find('ArticleTitle').itertext()) if a.find('ArticleTitle') is not None else '',
            journal=a.findtext('Journal/ISOAbbreviation') or a.findtext('Journal/Title') or '',
            year=a.findtext('Journal/JournalIssue/PubDate/Year')
                 or a.findtext('Journal/JournalIssue/PubDate/MedlineDate') or '',
            volume=a.findtext('Journal/JournalIssue/Volume') or '',
            issue=a.findtext('Journal/JournalIssue/Issue') or '',
            pages=a.findtext('Pagination/MedlinePgn') or a.findtext('Pagination/StartPage') or '',
            authors=[((au.findtext('LastName') or '') + ' ' + (au.findtext('Initials') or '')).strip()
                     for au in a.findall('AuthorList/Author')],
            ptypes=[p.text for p in a.findall('PublicationTypeList/PublicationType')],
        )
        for aid in art.findall('.//ArticleIdList/ArticleId'):
            if aid.get('IdType') == 'doi':
                rec['doi'] = aid.text
        out.append(rec)
    return out

def author_corpus(author):
    ids = []
    for start in range(0, 1000, 200):
        d = _get(E + "esearch.fcgi?db=pubmed&retmode=json&retmax=200&retstart=%d&term=%s"
                 % (start, urllib.parse.quote(author + '[Author]')))
        try:
            got = json.loads(d)['esearchresult']['idlist']
        except (ValueError, KeyError, TypeError):
            break
        ids += got
        if len(got) < 200:
            break
    recs = []
    for i in range(0, len(ids), 100):
        recs += parse_articles(_get(E + "efetch.fcgi?db=pubmed&retmode=xml&id=" + ",".join(ids[i:i + 100])))
        time.sleep(0.4)
    return recs

def extract_title(text):
    t = re.sub(r'^\s*(Expected\s+\d{4}\.\s*|In press\.\s*)', '', text.strip())
    parts = re.split(r'(?<=\.)\s+', t)
    return parts[1].rstrip('.') if len(parts) >= 2 else t[:180]

def title_search(title):
    ws = sorted([w for w in re.sub(r'[^A-Za-z0-9 ]', ' ', title).split()
                 if w.lower() not in STOP and len(w) > 3], key=len, reverse=True)[:6]
    if len(ws) < 2:
        return []
    for n in (len(ws), 3):
        term = ' AND '.join('%s[Title]' % w for w in ws[:n])
        d = _get(E + "esearch.fcgi?db=pubmed&retmode=json&retmax=10&term=" + urllib.parse.quote(term))
        try:
            ids = json.loads(d)['esearchresult']['idlist']
        except (ValueError, KeyError, TypeError):
            ids = []
        if ids:
            return parse_articles(_get(E + "efetch.fcgi?db=pubmed&retmode=xml&id=" + ",".join(ids)))
    return []

PROCEEDINGS = re.compile(r'\b(10S|CN_suppl|Suppl(ement)?[_ ]?\d|Abstract\b|e\d+-e\d+\b)', re.I)
UNPUBLISHED = re.compile(r'\b(in preparation|in prep\.?|submitted|under review|in review|planned|forthcoming)\b', re.I)
NEAR_MISS = 0.4          # below MATCH but above this: report the closest record instead of silence
MATCH = 0.6

def journal_mismatch(text, rec):
    """True when the matched record's journal is not named in the citation. The ISO
    abbreviation's tokens are matched as substrings so 'J Vasc Surg' also accepts
    'Journal of Vascular Surgery'; one-letter tokens are skipped."""
    jn = norm(rec.get('journal') or '')
    if not jn: return False
    t = norm(text)
    return any(tok not in t for tok in jn.split() if len(tok) > 1)

def categorize(text, rec, hint=''):
    t = text
    if UNPUBLISHED.search(t):
        return 'EXCLUDE', 'reads as unpublished; the template allows only published or in-press work'
    if hint == 'BC' or re.search(r'\b\(Eds?\)\b|In\s+[A-Z][a-z]+,\s', t):
        return 'BC', 'book chapter'
    if PROCEEDINGS.search(t):
        return 'PR', 'journal supplement / conference abstract'
    if rec:
        pt = set(rec['ptypes'])
        if 'Case Reports' in pt: return 'CR', 'PubMed type: Case Reports'
        if pt & {'Comment', 'Editorial'}: return 'ED', 'PubMed type: ' + ','.join(sorted(pt & {'Comment', 'Editorial'}))
        if 'Letter' in pt: return 'LT', 'PubMed type: Letter'
        if pt & {'Review', 'Systematic Review', 'Scoping Review', 'Meta-Analysis'}:
            return 'RA', 'PubMed type: ' + ','.join(sorted(pt & {'Review', 'Systematic Review', 'Scoping Review', 'Meta-Analysis'}))
        if pt & {'Practice Guideline', 'Guideline', 'Consensus Development Conference'}:
            return 'GL', 'PubMed type: guideline'
        return 'OR', 'PubMed-indexed original research'
    return 'RO', 'no PubMed record — not indexed; Original Research [OR] requires PubMed indexing'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--author', required=True, help='surname or "Surname II" for the author-level corpus search')
    ap.add_argument('--text', help='file with one citation per line')
    ap.add_argument('citations', nargs='?', help='JSON file: list of citation strings')
    args = ap.parse_args()

    if args.text:
        with open(args.text, encoding='utf-8') as f:
            cites = [l.strip() for l in f if l.strip()]
    elif args.citations:
        with open(args.citations, encoding='utf-8') as f:
            cites = json.load(f)
    else:
        cites = [l.strip() for l in sys.stdin if l.strip()]

    corpus = author_corpus(args.author)
    idx = [(set(toks(r['title'])), shingles(toks(r['title'])), r) for r in corpus if r['title']]

    seen = {}
    claimed = set()      # records a citation genuinely accounts for; abstracts and wrong-journal matches do not
    out = []
    for i, c in enumerate(cites, 1):
        ct = toks(c); cs = shingles(ct); cset = set(ct)
        best, bs = None, 0.0
        for tset, tsh, r in idx:
            if not tset: continue
            sc = 0.4 * (len(tset & cset) / max(1, len(tset))) + 0.6 * (len(tsh & cs) / max(1, len(tsh)))
            if sc > bs: bs, best = sc, r
        if bs < MATCH:
            for r in title_search(extract_title(c)):
                tset = set(toks(r['title'])); tsh = shingles(toks(r['title']))
                sc = 0.4 * (len(tset & cset) / max(1, len(tset))) + 0.6 * (len(tsh & cs) / max(1, len(tsh)))
                if sc > bs: bs, best = sc, r
            time.sleep(0.34)
        rec = best if bs >= MATCH else None
        cat, why = categorize(c, rec)
        flags = []
        if rec is None and best is not None and bs >= NEAR_MISS and cat != 'EXCLUDE':
            flags.append('NEAR MISS: closest PubMed record is PMID %s, "%s" (%s %s), similarity %.2f; '
                         'if this is the same paper the CV title is wrong, and the category above is not to be trusted'
                         % (best['pmid'], best['title'], best['journal'], best['year'], bs))
            why = 'no PubMed match at the %.1f threshold; see the NEAR MISS flag before treating this as not indexed' % MATCH
        if rec:
            if rec['pmid'] in seen:
                flags.append('DUPLICATE of entry #%d (same PMID %s)' % (seen[rec['pmid']], rec['pmid']))
            else:
                seen[rec['pmid']] = i
            sur = args.author.split()[0]
            if not any(sur.lower() in a.lower() for a in rec['authors']):
                flags.append('AUTHORSHIP: "%s" is not in the PubMed author list for PMID %s' % (sur, rec['pmid']))
            if rec['volume'] and rec['volume'] not in c:
                flags.append('CITATION: PubMed gives %s;%s(%s):%s — check the CV citation'
                             % (rec['year'], rec['volume'], rec['issue'], rec['pages']))
            if journal_mismatch(c, rec):
                flags.append('JOURNAL: PMID %s is in %s, which the citation does not name; a meeting abstract '
                             'matches its own full paper this way. The record is left unclaimed so it is still '
                             'reported below if the full paper is not on the CV' % (rec['pmid'], rec['journal']))
            elif cat == 'PR':
                flags.append('PROCEEDINGS: cited as an abstract but matched to PMID %s; check whether that is the full '
                             'paper and whether it is on the CV' % rec['pmid'])
            if cat not in ('PR',) and not any(f.startswith('JOURNAL') for f in flags):
                claimed.add(rec['pmid'])
        out.append(dict(index=i, text=c, pmid=(rec or {}).get('pmid'), score=round(bs, 3),
                        pubmed=rec, suggested_category=cat, reason=why, flags=flags))

    used = claimed
    missing = [r for r in corpus if r['pmid'] not in used]
    json.dump(dict(entries=out,
                   pubmed_records_not_on_cv=[dict(pmid=r['pmid'], title=r['title'], journal=r['journal'],
                                                  year=r['year'], ptypes=r['ptypes']) for r in missing]),
              sys.stdout, indent=1)

if __name__ == '__main__':
    main()