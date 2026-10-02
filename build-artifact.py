"""Gộp index.html + styles.css + app.js thành 1 file để đăng lên claude.ai (Artifact)."""
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text()
css = (root / 'styles.css').read_text()
js = (root / 'app.js').read_text()
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = body.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>')
out = f'<title>Sổ Thu Chi 6 Lọ</title>\n<style>\n{css}\n</style>\n{body.strip()}\n'
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'sothuchi.html').write_text(out)
print('dist/sothuchi.html', len(out), 'bytes')
