#!/usr/bin/env python3
"""Reproduce imported native animation from the pinned, unmodified source sheets.

Tool-only requirement: Pillow 12.3.0. No network or account data is accessed.
Clone/extract the documented immutable repositories outside the application,
then provide their roots. Output goes to a review directory, never to public/
unless explicitly requested. The existing source hashes and RGBA timeline are
verified before an output can be accepted.

Example:
 python3 scripts/reproduzir-animacoes-nativas.py --ebdx /tmp/ebdx-source \
   --pmd /tmp/pmd-source --output /tmp/myowndex-native-rebuilt
"""
import argparse
import hashlib
import json
import pathlib
import xml.etree.ElementTree as ET
from PIL import Image, ImageSequence

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def rgba(image):
    # Hidden RGB under alpha=0 does not change a displayed pixel. GIF's sole
    # transparent palette entry is canonical; all visible RGBA stays exact.
    return bytes(channel for pixel in image.convert('RGBA').get_flattened_data()
                 for channel in (pixel if pixel[3] else (0, 0, 0, 0)))


def verify_timeline(frames, durations, output):
    decoded = Image.open(output)
    timeline = []
    end = 0
    for image in ImageSequence.Iterator(decoded):
        end += image.info.get('duration', 0)
        timeline.append((end, rgba(image)))
    assert len({pixels for _, pixels in timeline}) > 1, 'A still is not animation'
    assert abs(end - sum(durations)) < .01, 'Native timing changed'
    start = 0
    for image, duration in zip(frames, durations):
        rendered = next(pixels for end, pixels in timeline if end > start + .001)
        assert rendered == rgba(image), 'Native pixels/alpha or frame order changed'
        start += duration


def transparent_crop(frames, padding=2):
    """Remove only transparent margins using one box for the entire sequence."""
    assert frames and all(frame.size == frames[0].size for frame in frames)
    width, height = frames[0].size
    boxes = [frame.getchannel('A').getbbox() for frame in frames]
    assert all(boxes), 'A native pose has no visible pixels'
    union = (min(box[0] for box in boxes), min(box[1] for box in boxes),
             max(box[2] for box in boxes), max(box[3] for box in boxes))
    box = (max(0, union[0] - padding), max(0, union[1] - padding),
           min(width, union[2] + padding), min(height, union[3] + padding))
    cropped = [frame.crop(box) for frame in frames]
    for original, frame in zip(frames, cropped):
        restored = Image.new('RGBA', (width, height))
        restored.paste(frame, (box[0], box[1]))
        assert rgba(restored) == rgba(original), 'Crop removed native visible RGBA'
    proof = {
        'sourceFrameSize': [width, height],
        'alphaUnionBox': list(union),
        'cropBox': list(box),
        'paddingPixels': padding,
        'removedOnlyTransparent': True,
        'sourceVisibleRgbaSha256': [digest(bytes(channel for pixel in frame.get_flattened_data()
                                               if pixel[3] for channel in pixel)) for frame in frames],
        'croppedFrameRgbaSha256': [digest(rgba(frame)) for frame in cropped],
    }
    return cropped, proof


def gif(frames, output, comment=None, durations=None, optimize=False):
    colors = sorted({pixel[:3] for image in frames for pixel in image.get_flattened_data() if pixel[3]})
    assert len(colors) <= 255
    assert all(pixel[3] in (0, 255) for image in frames for pixel in image.get_flattened_data())
    indices = {color: index + 1 for index, color in enumerate(colors)}
    palette = [0, 0, 0] + [value for color in colors for value in color]
    palette += [0] * (768 - len(palette))
    encoded = []
    for frame in frames:
        image = Image.new('P', frame.size)
        image.putpalette(palette)
        image.putdata(bytes(indices[pixel[:3]] if pixel[3] else 0 for pixel in frame.get_flattened_data()))
        encoded.append(image)
    options = {'save_all': True, 'append_images': encoded[1:], 'duration': durations or 100,
               'loop': 0, 'transparency': 0, 'disposal': 2, 'optimize': optimize}
    if comment is not None:
        options['comment'] = comment
    encoded[0].save(output, **options)


def reproduce_2d(source, directory):
    """Rebuild the content-addressed batch without guessing poses or palettes."""
    meta = json.loads((PUBLIC / 'sprites/native/provenance-2d.json').read_text())
    written = set()
    for entry in meta['assets']:
        raw = (source / entry['sourcePath']).read_bytes()
        assert digest(raw) == entry['sourceSha256'], entry['sourcePath']
        blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        assert blob == entry['sourceBlob'], entry['sourcePath']
        image = Image.open(source / entry['sourcePath']).convert('RGBA')
        width, height = image.size
        assert width == height * entry['sourceFrames']
        assert [height, height] == entry['sourceFrameSize']
        frames = [image.crop((index * height, 0, (index + 1) * height, height))
                  for index in range(entry['sourceFrames'])]
        boxes = [frame.getchannel('A').getbbox() for frame in frames]
        union = [min(box[0] for box in boxes), min(box[1] for box in boxes),
                 max(box[2] for box in boxes), max(box[3] for box in boxes)]
        assert union == entry['bodyBounds'], 'Authored frame bounds changed'
        crop = entry['cropBox']
        frames = [frame.crop(crop) for frame in frames]
        assert list(frames[0].size) == entry['frameSize']
        assert len({digest(frame.tobytes()) for frame in frames}) == entry['uniqueFrames']
        durations = [entry['nativeFrameDurationMs']] * len(frames)
        output = target(directory, entry['animated'])
        if entry['animated'] not in written:
            if output.suffix == '.gif':
                gif(frames, output, durations=durations, optimize=True)
            else:
                frames[0].save(output, format='PNG', save_all=True, append_images=frames[1:],
                               duration=durations, loop=0, disposal=0, blend=0)
            verify_timeline(frames, durations, output)
            assert digest(output.read_bytes()) == entry['animatedSha256'], output
            written.add(entry['animated'])
        static = target(directory, entry['static'])
        if entry['static'] not in written:
            frames[0].save(static, format='PNG')
            assert digest(static.read_bytes()) == entry['staticSha256'], static
            written.add(entry['static'])
    return len(meta['assets'])


def target(directory, url):
    assert url.startswith('/sprites/native/')
    output = directory / pathlib.Path(url).name
    output.parent.mkdir(parents=True, exist_ok=True)
    return output


def reproduce_ebdx(source, directory):
    meta = json.loads((PUBLIC / 'sprites/native/provenance-ebdx.json').read_text())
    for entry in meta['assets']:
        raw = (source / entry['sourcePath']).read_bytes()
        assert digest(raw) == entry['sourceSha256'], entry['sourcePath']
        blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        assert blob == entry['sourceBlob'], entry['sourcePath']
        strip = Image.open(source / entry['sourcePath']).convert('RGBA')
        width, height = strip.size
        assert width % height == 0
        frames = [strip.crop((index * height, 0, (index + 1) * height, height))
                  for index in range(width // height)]
        assert len(frames) == entry['nativeFrames']
        output = target(directory, entry['animated'])
        comment = f"{meta['repository']}@{meta['commit']}: {entry['sourcePath']}; native sheet frames, 100ms".encode()
        gif(frames, output, comment)
        verify_timeline(frames, [100] * len(frames), output)
        assert digest(output.read_bytes()) == entry['gifSha256'], output
        Image.open(output).convert('RGBA').save(target(directory, entry['static']))
        assert digest(target(directory, entry['static']).read_bytes()) == entry['staticSha256']
    icon = json.loads((PUBLIC / 'sprites/native/provenance-menu-icon.json').read_text())
    raw = (source / icon['sourcePath']).read_bytes()
    assert digest(raw) == icon['sourceSha256']
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == icon['sourceGitBlob']
    sheet = Image.open(source / icon['sourcePath']).convert('RGBA')
    width, height = icon['frameSize']
    frames = [sheet.crop((index * width, 0, (index + 1) * width, height))
              for index in range(icon['nativeFrames'])]
    assert icon['type'] == 'native-menu-icon'
    assert sum(icon['apngDurationMs']) == icon['nativeCycleMs']
    output = target(directory, icon['animated'])
    frames[0].save(output, format='PNG', save_all=True, append_images=frames[1:],
                   duration=icon['apngDurationMs'], loop=0, disposal=0, blend=0)
    verify_timeline(frames, icon['apngDurationMs'], output)
    assert digest(output.read_bytes()) == icon['assets'][output.name]['sha256']
    output = target(directory, icon['static'])
    frames[0].save(output, format='PNG')
    assert digest(output.read_bytes()) == icon['assets'][output.name]['sha256']
    return len(meta['assets']) + 1


def reproduce_pmd(source, directory):
    meta = json.loads((PUBLIC / 'sprites/native/provenance-pmd.json').read_text())
    for entry in meta['records']:
        folder = source / 'sprite' / entry['sourceId']
        xml = folder / 'AnimData.xml'
        sheet = folder / (entry['animation'] + '-Anim.png')
        assert digest(xml.read_bytes()) == entry['sourceXmlSha256']
        assert digest(sheet.read_bytes()) == entry['sourceSheetSha256']
        if entry.get('sourceCreditsSha256'):
            assert digest((folder / 'credits.txt').read_bytes()) == entry['sourceCreditsSha256']
        animation = next(item for item in ET.parse(xml).getroot().findall('./Anims/Anim')
                         if item.findtext('Name') == entry['animation'])
        width, height = int(animation.findtext('FrameWidth')), int(animation.findtext('FrameHeight'))
        ticks = [int(item.text) for item in animation.findall('./Durations/Duration')]
        image = Image.open(sheet).convert('RGBA')
        assert image.size == (width * len(ticks), height * 8)
        durations, total, previous = [], 0, 0
        for tick in ticks:
            total += tick
            rounded = round(total * 1000 / 60)
            durations.append(rounded - previous)
            previous = rounded
        for direction, row in [('front', 0), ('back', 4)]:
            expected = entry[direction]
            assert ticks == expected['nativeTicks']
            frames = [image.crop((index * width, row * height, (index + 1) * width, (row + 1) * height))
                      for index in range(len(ticks))]
            if expected.get('transparentCrop'):
                frames, proof = transparent_crop(frames, expected['transparentCrop']['paddingPixels'])
                assert proof == expected['transparentCrop'], 'Native crop proof changed'
                assert list(frames[0].size) == expected['size']
            assert len({(frame.crop(frame.getbbox()).size, frame.crop(frame.getbbox()).tobytes())
                        for frame in frames}) > 1, 'Rigid translation is not body animation'
            output = target(directory, expected['animated'])
            frames[0].save(output, format='PNG', save_all=True, append_images=frames[1:],
                           duration=durations, loop=0, disposal=0, blend=0)
            verify_timeline(frames, durations, output)
            assert digest(output.read_bytes()) == expected['sha256'], output
            frames[0].save(target(directory, expected['static']), format='PNG')
            assert digest(target(directory, expected['static']).read_bytes()) == expected['staticSha256']
    return len(meta['records']) * 2


parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--ebdx', type=pathlib.Path)
parser.add_argument('--ebdx-2d', type=pathlib.Path,
                    help='Reproduce the new 2D batch from the pinned EBDX source.')
parser.add_argument('--pmd', type=pathlib.Path)
parser.add_argument('--output', type=pathlib.Path, required=True)
args = parser.parse_args()
if not args.ebdx and not args.ebdx_2d and not args.pmd:
    parser.error('Provide at least one unmodified pinned source repository.')
count = 0
if args.ebdx:
    count += reproduce_ebdx(args.ebdx, args.output)
if args.ebdx_2d:
    count += reproduce_2d(args.ebdx_2d, args.output)
if args.pmd:
    count += reproduce_pmd(args.pmd, args.output)
print(f'Verified {count} native animation timelines; immutable bytes reproduced in {args.output}.')
