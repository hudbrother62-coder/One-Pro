from pathlib import Path
p=Path('src/ppt-report.tsx')
s=p.read_text()
s=s.replace('    deck.lang = "id-ID";\n','')
s=s.replace('    deck.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "id-ID" };','    deck.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };')
s=s.replace('      s.addTable(rows, {','      s.addTable(rows as any, {',1)
p.write_text(s)
