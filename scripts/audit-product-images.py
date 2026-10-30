"""Review public catalog photos without changing products, prices or admin data.

Run from the repository root with Python + Pillow + requests. Downloads are cached under
.data/image-review. Exact model matches only; no guessed family substitutions.
"""
import concurrent.futures
import hashlib
import html
import io
import json
import re
import threading
import requests
from collections import Counter, defaultdict
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.data/image-review'
CACHE.mkdir(parents=True, exist_ok=True)


_thread = threading.local()

def fetch(url, limit=4_000_000):
    if not hasattr(_thread, 'session'):
        _thread.session = requests.Session()
    with _thread.session.get(url, timeout=(10, 20), stream=True) as response:
        response.raise_for_status()
        chunks, total = [], 0
        for chunk in response.iter_content(65536):
            total += len(chunk)
            if total > limit:
                raise ValueError('Response exceeds review download limit')
            chunks.append(chunk)
        data = b''.join(chunks)
    return data


def normalize(value):
    return re.sub(r'[^a-zа-яё0-9]', '', html.unescape(value).lower())


def dimensions(data):
    with Image.open(io.BytesIO(data)) as image:
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        return list(image.size)


def adequate(size):
    return min(size) >= 200 and max(size) >= 400 and size[0] * size[1] >= 80000


def review(pair):
    product, candidates = pair
    original = product.get('image', '')
    result = {key: product.get(key) for key in ['id', 'brand', 'model']}
    result['previousImage'] = original
    if original and not original.startswith(('assets/kss/', 'assets/ezviz/', 'assets/neocam/')):
        result['status'] = 'keep-custom-image'
        return result
    try:
        local = ROOT / original if original and not original.startswith('http') else None
        old_size = dimensions(local.read_bytes()) if local and local.is_file() else None
    except Exception:
        old_size = None
    result['previousDimensions'] = old_size
    if old_size and adequate(old_size):
        result['status'] = 'keep-resolution-adequate'
        return result
    if len(candidates) != 1:
        result['status'] = 'needs-exact-source' if not candidates else 'ambiguous-source'
        return result
    source = candidates[0]
    result.update(sourcePage=source.get('link', ''), sourceImage=source.get('imageUrl', ''), sourceBrand=source.get('brand', ''))
    url = result['sourceImage']
    if not url.startswith('https://kss.uz/wp-content/') or any(term in url.lower() for term in ['placeholder', 'no-image', 'noimage']):
        result['status'] = 'needs-image-source'
        return result
    cache = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.img')
    try:
        data = cache.read_bytes() if cache.is_file() else fetch(url)
        size = dimensions(data)
        if not cache.is_file():
            cache.write_bytes(data)
        result.update(sourceDimensions=size, sourceBytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        if not adequate(size):
            result['status'] = 'source-too-small'
        elif old_size and size[0] * size[1] < old_size[0] * old_size[1] * 1.5:
            result['status'] = 'source-not-better'
        else:
            result['status'] = 'candidate-exact-model'
    except Exception as error:
        result['status'] = 'source-unavailable'
        result['error'] = str(error)[:150]
    return result


def main():
    catalog_file = CACHE / 'live-catalog.json'
    sources_file = CACHE / 'kss-public-products.json'
    if not catalog_file.exists():
        catalog_file.write_bytes(fetch('https://texnocam-miniapp.onrender.com/api/products'))
    if not sources_file.exists():
        sources_file.write_bytes(fetch('https://kss.uz/wp-json/kss/v1/products', limit=24_000_000))
    products = json.loads(catalog_file.read_text())['products']
    sources = json.loads(sources_file.read_text())
    index = defaultdict(list)
    for source in sources:
        index[normalize(source['name'])].append(source)
    work = []
    for product in products:
        candidates = index[normalize(product['model'])]
        # These brands append sales descriptions after the complete model code.
        # Preserve explicit pack count so a single unit never becomes a kit.
        if not candidates and product['brand'] in ['Tapo', 'TP-Link', 'Mercusys']:
            match = re.search(r'\(([^)]*)\)\s*$', product['model'])
            if match:
                suffix = match[1]
                base = product['model'][:match.start()].strip()
                if 'pack' in suffix.lower():
                    pack = re.match(r'\s*(\d+)-pack', suffix, re.I)
                    base = base + '(' + pack[1] + '-pack)' if pack else product['model']
                candidates = index[normalize(base)]
        # Repeated source rows with the same model and photo are one candidate.
        candidates = list({item.get('imageUrl', ''): item for item in candidates}.values())
        work.append((product, candidates))
    records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for future in concurrent.futures.as_completed([pool.submit(review, pair) for pair in work]):
            record = future.result()
            records.append(record)
            if len(records) % 100 == 0:
                print('Reviewed', len(records), '/', len(work), dict(Counter(row['status'] for row in records)), flush=True)
                (CACHE / 'checkpoint.json').write_text(json.dumps(records, ensure_ascii=False))
    hashes = defaultdict(list)
    for record in records:
        if record.get('sha256'):
            hashes[record['sha256']].append(record)
    for group in hashes.values():
        if len(group) >= 12:
            for record in group:
                if record['status'] == 'candidate-exact-model':
                    record['status'] = 'needs-shared-photo-review'
    report = {'reviewedAt': '2026-10-30', 'catalogCount': len(products),
              'sourceCatalog': 'https://kss.uz/wp-json/kss/v1/products',
              'criteria': 'Exact normalized full model; adequate native dimensions; custom admin images preserved; no fuzzy substitutions.',
              'summary': dict(Counter(row['status'] for row in records)), 'products': records}
    (CACHE / 'base-review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'assets/product-image-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report['summary']), flush=True)


if __name__ == '__main__':
    main()
