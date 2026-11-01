"""Calibrate the static v4 plate against a fixed clean wall, then make a preview."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/shadow-overlay/static-v4-r3'
raw=np.asarray(Image.open(OUT/'raw-shadow.png')).astype(np.float32)
plate=np.asarray(Image.open(OUT/'white-plate.png')).astype(np.float32)
white=float(np.median(plate))
assert 0<white<65000, 'The calibration plate must have highlight headroom'
assert raw.shape==(1080,1920)
ratio=np.clip(raw/white,0,1)
mask=np.uint8(np.rint(ratio*255))
Image.fromarray(mask).save(OUT/'shadow-mask.png')
Image.fromarray(mask).save(OUT/'shadow-poster.webp',lossless=True)
wall=np.array([244,239,233],dtype=np.float32)
texture=np.random.default_rng(41).normal(0,0.35,mask.shape).astype(np.float32)
warm=(0.6+0.4*ratio[:,:,None])*(wall+texture[:,:,None])
Image.fromarray(np.uint8(np.clip(np.rint(warm),0,255))).save(OUT/'shadow-preview.png')
report={'resolution':[1920,1080],'raw_bit_depth':16,'white_reference':white,
        'white_plate_range':[float(plate.min()),float(plate.max())],
        'raw_clipped_pixel_fraction':float(np.mean(raw==65535)),
        'white_mask_fraction':float(np.mean(mask==255)),
        'normalization':'fixed clean-wall median in encoded Standard/sRGB luminance',
        'background_baked_into_mask':False,'preview_wall':'#f4efe9','intensity':0.4,
        'animation_started':False}
encoded_white=white/65535
report['estimated_old_exposure_unclipped_linear_white']=2*((encoded_white+0.055)/1.055)**2.4
(OUT/'qa-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
