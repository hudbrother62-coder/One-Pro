from pathlib import Path
p=Path('src/Prototype.tsx')
s=p.read_text()
s=s.replace('cx("org-chat-shell", selectedContact && "has-selection")','cx("org-chat-shell", Boolean(selectedContact) && "has-selection")')
p.write_text(s)
