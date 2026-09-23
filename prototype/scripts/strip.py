# يجمع إطارات مجلد في شريط واحد (أعمدة × صفوف) بمقياس، مع قصّ الارتفاع اختيارياً
import sys, os
from PIL import Image
d, out, cols, scale, crop = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5])
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
ims = [Image.open(os.path.join(d, f)).convert('RGB') for f in files]
if crop: ims = [im.crop((0, 0, im.width, min(im.height, crop))) for im in ims]
w, h = int(ims[0].width * scale), int(ims[0].height * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols + (cols - 1) * 4, h * rows + (rows - 1) * 4), (200, 200, 200))
for k, im in enumerate(ims):
    sheet.paste(im.resize((w, h), Image.LANCZOS), ((k % cols) * (w + 4), (k // cols) * (h + 4)))
sheet.save(out)
