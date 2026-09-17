from pathlib import Path
import re

p=Path('src/Prototype.tsx')
s=p.read_text()

# Icons used by the mobile drawer and direct organizational chat.
if '  ArrowLeft,\n' not in s:
    s=s.replace('  Bell,\n','  ArrowLeft,\n  Bell,\n  Buildings,\n  ChatCircleDots,\n',1)
if '  List,\n' not in s:
    s=s.replace('  MagnifyingGlass,\n','  List,\n  MagnifyingGlass,\n',1)
if '  PaperPlaneTilt,\n' not in s:
    s=s.replace('  PencilSimple,\n','  PaperPlaneTilt,\n  PencilSimple,\n',1)

s=s.replace('{screen === "chat" ? <Chat notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} /> : null}',
            '{screen === "chat" ? <Chat notify={notify} workspace={workspace} userId={authUser?.id} previewMode={previewMode} role={role} /> : null}')

old='''      <header className="topbar">
        <button className="brand-button" onClick={() => go("home")} aria-label="Buka beranda">
          <img src="/brand/one-pro-logo.svg" alt="One Pro" />
          <span><strong>One Pro</strong><small>Jurnal Digital</small></span>
        </button>
        <div className="top-actions">'''
new='''      <header className="topbar">
        <div className="topbar-leading">
          <button className="mobile-menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Buka navigasi"><List size={22} /></button>
          <button className="brand-button" onClick={() => go("home")} aria-label="Buka beranda">
            <img src="/brand/one-pro-logo.svg" alt="One Pro" />
            <span><strong>One Pro</strong><small>Jurnal Digital</small></span>
          </button>
        </div>
        <div className="top-actions">'''
if old in s: s=s.replace(old,new,1)

s=s.replace('<button className={cx(menuOpen && "active")} onClick={() => setMenuOpen(true)}><Gear size={21} /><span>Lainnya</span></button>',
            '<button className={cx(menuOpen && "active")} onClick={() => setMenuOpen(true)}><List size={21} /><span>Menu</span></button>')

# Replace bottom-sheet menu with the left navigation drawer requested for mobile.
s=re.sub(r'''\n\s*<BottomSheet open=\{menuOpen\}.*?</BottomSheet>''', '''

      {menuOpen ? <div className="mobile-nav-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
        <aside className="mobile-nav-drawer" aria-label="Navigasi mobile">
          <div className="mobile-nav-head">
            <button className="mobile-nav-brand" onClick={() => go("home")}><span className="desktop-brand-logo"/><span><strong>One Pro</strong><small>Jurnal Digital</small></span></button>
            <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Tutup navigasi"><X size={19}/></button>
          </div>
          <div className="mobile-nav-scope"><span>AKSES AKUN</span><strong>{role}</strong><small>Daerah Malang Timur</small></div>
          <nav className="mobile-nav-list">{allowedNavigation.map((item) => { const Icon=item.icon; return <button key={item.id} className={cx(screen===item.id&&"active")} onClick={() => go(item.id)}><Icon size={20} weight={screen===item.id?"fill":"regular"}/><span>{item.label}</span><CaretRight size={15}/></button>; })}</nav>
          <button className="mobile-nav-logout" onClick={() => void signOut()}><SignOut size={18}/>Keluar akun</button>
        </aside>
      </div> : null}''', s, count=1, flags=re.S)

start=s.find('function Chat({')
end=s.find('\nfunction ChatRow(',start)
if start<0 or end<0:
    raise SystemExit('Chat block not found')

new_chat=r'''type OrgContactType = "area" | "village" | "group";
type OrgContact = { type: OrgContactType; id: string; name: string; subtitle: string; initials: string };
type OrgConversation = { id: string; scope_a_type: OrgContactType; scope_a_id: string; scope_b_type: OrgContactType; scope_b_id: string; updated_at: string };
type OrgMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type CurrentScope = { role: AccountRole; area_id: string | null; village_id: string | null; group_id: string | null };

function Chat({ notify, workspace, userId, previewMode, role }: { notify: (message: string) => void; workspace: WorkspaceData; userId?: string; previewMode: boolean; role: Role }) {
  const [scope, setScope] = useState<CurrentScope | null>(null);
  const [conversations, setConversations] = useState<OrgConversation[]>([]);
  const [messages, setMessages] = useState<OrgMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState<OrgContact | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");

  const roleKey: Record<Role, AccountRole> = { "Super Admin": "super_admin", "Admin Daerah": "admin_daerah", "Admin Desa": "admin_desa", "PJ Kelompok": "pj_kelompok", "Pengajar": "pengajar" };

  const refreshChat = async (showLoading = true) => {
    if (previewMode || !supabase || !userId) return;
    if (showLoading) setLoading(true);
    try {
      const [membershipResult, conversationResult, messageResult] = await Promise.all([
        supabase.from("memberships").select("role,area_id,village_id,group_id").eq("user_id", userId).eq("role", roleKey[role]).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("org_conversations").select("id,scope_a_type,scope_a_id,scope_b_type,scope_b_id,updated_at").order("updated_at", { ascending: false }),
        supabase.from("org_messages").select("id,conversation_id,sender_id,body,created_at").order("created_at", { ascending: true }),
      ]);
      if (membershipResult.error) throw membershipResult.error;
      if (conversationResult.error) throw conversationResult.error;
      if (messageResult.error) throw messageResult.error;
      setScope((membershipResult.data ?? null) as CurrentScope | null);
      setConversations((conversationResult.data ?? []) as OrgConversation[]);
      setMessages((messageResult.data ?? []) as OrgMessage[]);
    } catch (error) { notify(error instanceof Error ? error.message : "Komunikasi gagal dimuat"); }
    finally { if (showLoading) setLoading(false); }
  };

  useEffect(() => {
    if (previewMode) {
      setScope({ role: roleKey[role], area_id: workspace.areas[0]?.id ?? "demo-area", village_id: workspace.villages[0]?.id ?? "demo-village", group_id: workspace.groups[0]?.id ?? "demo-group" });
      return;
    }
    void refreshChat();
  }, [previewMode, userId, role]);

  useEffect(() => {
    if (previewMode || !supabase || !userId) return;
    const channel = supabase.channel(`one-pro-org-chat-${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "org_messages" }, () => { void refreshChat(false); }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [previewMode, userId, role]);

  const contacts = useMemo<OrgContact[]>(() => {
    if (!scope) return [];
    const make = (type: OrgContactType, id: string, name: string, subtitle: string): OrgContact => ({ type, id, name, subtitle, initials: name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "OP" });
    if (role === "Admin Daerah") {
      const villages = workspace.villages.filter(v => !scope.area_id || v.area_id === scope.area_id);
      const villageIds = new Set(villages.map(v => v.id));
      return [
        ...villages.map(v => make("village", v.id, `Desa ${v.name}`, "Admin Desa")),
        ...workspace.groups.filter(g => villageIds.has(g.village_id)).map(g => make("group", g.id, `Kelompok ${g.name}`, "PJ Kelompok")),
      ];
    }
    if (role === "Admin Desa") {
      const village = workspace.villages.find(v => v.id === scope.village_id);
      const area = village ? workspace.areas.find(a => a.id === village.area_id) : null;
      return [
        ...(area ? [make("area", area.id, `Daerah ${area.name}`, "Admin Daerah")] : []),
        ...workspace.groups.filter(g => g.village_id === scope.village_id).map(g => make("group", g.id, `Kelompok ${g.name}`, "PJ Kelompok")),
      ];
    }
    if (role === "PJ Kelompok" || role === "Pengajar") {
      const group = workspace.groups.find(g => g.id === scope.group_id);
      const village = group ? workspace.villages.find(v => v.id === group.village_id) : null;
      const area = village ? workspace.areas.find(a => a.id === village.area_id) : null;
      return [
        ...(area ? [make("area", area.id, `Daerah ${area.name}`, "Admin Daerah")] : []),
        ...(village ? [make("village", village.id, `Desa ${village.name}`, "Admin Desa")] : []),
      ];
    }
    return [];
  }, [scope, role, workspace.areas, workspace.villages, workspace.groups]);

  const visibleContacts = contacts.filter(contact => `${contact.name} ${contact.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()));
  const conversationFor = (contact: OrgContact) => conversations.find(c => (c.scope_a_type === contact.type && c.scope_a_id === contact.id) || (c.scope_b_type === contact.type && c.scope_b_id === contact.id));
  const latestFor = (contact: OrgContact) => {
    const conversation = conversationFor(contact);
    if (!conversation) return null;
    const rows = messages.filter(message => message.conversation_id === conversation.id);
    return rows[rows.length - 1] ?? null;
  };
  const selectedMessages = selectedConversationId ? messages.filter(message => message.conversation_id === selectedConversationId) : [];

  const openContact = async (contact: OrgContact) => {
    setSelectedContact(contact);
    if (previewMode) { setSelectedConversationId(`preview-${contact.type}-${contact.id}`); return; }
    if (!supabase) return;
    const existing = conversationFor(contact);
    if (existing) { setSelectedConversationId(existing.id); return; }
    const { data, error } = await supabase.rpc("open_org_conversation", { p_target_type: contact.type, p_target_id: contact.id });
    if (error || !data) { notify(error?.message || "Percakapan tidak dapat dibuka"); return; }
    setSelectedConversationId(String(data));
    await refreshChat(false);
  };

  const send = async () => {
    const clean = body.trim();
    if (!clean || !selectedConversationId || !userId || sending) return;
    if (previewMode) { setBody(""); notify("Mode pratinjau: pesan siap dikirim pada akun nyata"); return; }
    if (!supabase) return;
    setSending(true);
    const { error } = await supabase.from("org_messages").insert({ conversation_id: selectedConversationId, sender_id: userId, body: clean });
    setSending(false);
    if (error) { notify(error.message); return; }
    setBody("");
    await refreshChat(false);
  };

  return <>
    <PageHeader title="Komunikasi" subtitle="Chat langsung antara Daerah, Desa, dan Kelompok" />
    <section className={cx("org-chat-shell", selectedContact && "has-selection")}>
      <aside className="org-contact-pane">
        <div className="org-contact-head"><div><ChatCircleDots size={21}/><span><strong>Kontak</strong><small>{contacts.length} unit tersedia</small></span></div></div>
        <label className="org-chat-search"><MagnifyingGlass size={16}/><KeyboardInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari desa atau kelompok"/></label>
        <div className="org-contact-list">{loading ? <div className="chat-empty">Memuat kontak…</div> : visibleContacts.length ? visibleContacts.map(contact => { const latest=latestFor(contact); const conversation=conversationFor(contact); return <button key={`${contact.type}-${contact.id}`} className={cx("org-contact-row",selectedContact?.type===contact.type&&selectedContact.id===contact.id&&"active")} onClick={() => void openContact(contact)}><span className="org-contact-avatar"><Buildings size={18}/></span><span className="org-contact-copy"><strong>{contact.name}</strong><small>{latest?.body || contact.subtitle}</small></span><em>{latest ? new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"}).format(new Date(latest.created_at)) : conversation ? "Aktif" : ""}</em></button>; }) : <div className="chat-empty">Tidak ada kontak pada lingkup akun ini.</div>}</div>
      </aside>
      <div className="org-conversation-pane">{selectedContact ? <>
        <header className="org-conversation-head"><button className="org-chat-back" onClick={() => { setSelectedContact(null); setSelectedConversationId(null); }} aria-label="Kembali ke kontak"><ArrowLeft size={20}/></button><span className="org-contact-avatar"><Buildings size={18}/></span><div><strong>{selectedContact.name}</strong><small>{selectedContact.subtitle} · online melalui One Pro</small></div></header>
        <div className="org-message-scroll">{selectedMessages.length ? selectedMessages.map(message => <article key={message.id} className={cx("org-bubble",message.sender_id===userId&&"mine")}><p>{message.body}</p><small>{message.sender_id===userId?"Anda · ":""}{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(message.created_at))}</small></article>) : <div className="org-chat-welcome"><ChatCircleDots size={30}/><strong>Mulai percakapan</strong><p>Pesan ini langsung tersimpan di ONE PRO dan dapat dibalas oleh {selectedContact.name}.</p></div>}</div>
        <div className="org-chat-composer"><KeyboardInput value={body} onChange={event=>setBody(event.target.value)} placeholder={`Pesan ke ${selectedContact.name}`} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send();}}}/><button disabled={sending||!body.trim()} onClick={()=>void send()} aria-label="Kirim pesan"><PaperPlaneTilt size={19} weight="fill"/></button></div>
      </> : <div className="org-chat-placeholder"><ChatCircleDots size={38}/><h2>Pilih kontak</h2><p>Pilih Daerah, Desa, atau Kelompok di sebelah kiri untuk membuka percakapan langsung.</p></div>}</div>
    </section>
  </>;
}
'''
s=s[:start]+new_chat+s[end:]

# Persistent design decisions.
a=Path('AGENTS.md')
text=a.read_text()
marker='## Mobile navigation and organizational chat decisions — 2026-09-17'
if marker not in text:
    text += '''\n\n## Mobile navigation and organizational chat decisions — 2026-09-17\n\n- Mobile uses a left-side navigation drawer opened from the top bar and the bottom Menu action. The drawer mirrors role-allowed desktop navigation and includes logout. Keep desktop sidebar behavior unchanged.\n- Communication is contact-first, not thread-creation-first. Users never type a chat title or manually create a group thread. Contacts are derived from the organization hierarchy.\n- Admin Daerah sees every Desa in its Daerah and every Kelompok beneath those Desa. Admin Desa sees its parent Daerah and every Kelompok under that Desa. PJ Kelompok/Pengajar sees its parent Desa and Daerah.\n- Direct communication pairs are Daerah–Desa, Daerah–Kelompok, and Desa–Kelompok. Conversations and messages are stored in `org_conversations` and `org_messages`, protected by RLS and refreshed with Supabase Realtime.\n- On mobile, contact list and conversation are separate views with an in-chat back button; on desktop they form a two-column WhatsApp-like workspace.\n'''
    a.write_text(text)

p.write_text(s)
