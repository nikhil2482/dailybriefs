import { useState, useEffect } from "react";

const ACCENT = "#4A8CFF";

const INTEREST_OPTIONS = [
  "Artificial Intelligence", "Venture Capital", "Finance & Banking",
  "Software Engineering", "Startups & Entrepreneurship", "Geopolitics",
  "Climate Tech", "Biotech & Health", "Crypto & Web3", "Consulting",
  "Product Management", "Policy & Law", "Real Estate", "Media & Journalism",
  "Sports Business", "Consumer & Retail", "Defense & National Security",
  "Education", "Space & Deep Tech", "Marketing & Growth"
];

const SECTION_META = [
  { color: "#4A8CFF", icon: "📡" },
  { color: "#4AFFD4", icon: "🎯" },
  { color: "#FF8C4A", icon: "📰" },
  { color: "#C44AFF", icon: "👁️" },
  { color: "#FFD74A", icon: "🧠" },
  { color: "#FF6B6B", icon: "⚡" },
];

function useStorage(key, fallback) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
  });
  const save = (v) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, save];
}

function buildPrompt(p, length) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const cfg = {
    short:  { lede:"2 sentences", career:"3 stories, 2 sentences each", top:"4 stories, 2 sentences each", think:"3 sentences", watch:"3 items, 1–2 sentences each", hits:"5 bullets", tokens: 1400 },
    medium: { lede:"3–4 sentences", career:"4 stories, 3–4 sentences each", top:"5 stories, 3 sentences each", think:"5 sentences", watch:"4 items, 2 sentences each", hits:"7 bullets", tokens: 2600 },
    long:   { lede:"5 sentences with rich context", career:"6 stories, 5 sentences each with deep analysis", top:"8 stories, 4 sentences each", think:"7–9 sentences with specific actions", watch:"6 items, 3 sentences each", hits:"10 bullets", tokens: 4500 },
  }[length];

  return {
    tokens: cfg.tokens,
    prompt: `You are writing a personalized daily intelligence brief for ${p.name}.

Their background and career goals: ${p.career}
Their additional interest areas: ${p.interests?.length ? p.interests.join(", ") : "general world news"}
Today's date: ${today}
Brief length setting: ${length.toUpperCase()}

Use EXACTLY these section headers. No deviations. No extra headers.

## THE LEDE
${cfg.lede}. The single biggest macro development today — economic, geopolitical, or industry-wide — that a smart, driven person needs to know. Be sharp, direct, and confident. No hedging.

## CAREER RADAR
${cfg.career}. Stories tied directly to ${p.name}'s background, aspirations, and target industries. Include hiring signals, company moves, industry shifts, and opportunities. For each story use this exact format:
**[STORY HEADLINE]** · [Publication] · [X hours/days ago]
[Summary sentences — make it feel personal to their specific goals]

## TOP STORIES TODAY
${cfg.top}. Important news across all their stated interest areas — mix of markets, tech, policy, business, and world events. For each story:
**[STORY HEADLINE]** · [Publication] · [X hours/days ago]
[Summary with context on why it matters broadly]

## WHAT YOU SHOULD BE THINKING
Write this entire section from the first-person perspective of who ${p.name} wants to BECOME — not who they are today. If they want to be in VC, think like a VC. If they want to work at Goldman, think like a Goldman analyst. If they want to be an operator, think like a founder-CEO. ${cfg.think}. Take one important theme from today's news and give them the mental model, the real implication under the surface, and the specific edge they can get from understanding it clearly.

## WHAT TO WATCH
${cfg.watch}. Forward-looking signals — things developing over the next 30–90 days that will matter. What to track and why. Format each as:
**[Watch Item]**: [explanation and what to look for]

## QUICK HITS
${cfg.hits} of rapid-fire news across all their interest areas. One punchy sentence each.
• [Topic area]: [news item + one-sentence so-what]

Be direct. Be specific. Use real-sounding data and source names. No fluff. No disclaimers. Write like ${p.name}'s time is the most valuable thing in the room.`
  };
}

function parseBrief(text) {
  const sections = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.replace("## ", "").trim(), content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export default function DailyBriefs() {
  const [profiles, setProfiles] = useStorage("db_profiles", []);
  const [activeProfileId, setActiveProfileId] = useStorage("db_active_profile", null);
  const [briefs, setBriefs] = useStorage("db_briefs", {});
  const [screen, setScreen] = useState("loading");
  const [setupStep, setSetupStep] = useState(0);
  const [form, setForm] = useState({ name: "", career: "", interests: [] });
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [briefLength, setBriefLength] = useStorage("db_length", "medium");
  const [expandedSection, setExpandedSection] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);

  const today = new Date().toDateString();
  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;
  const briefKey = `${activeProfileId}_${today}_${briefLength}`;
  const currentBrief = briefs[briefKey] || null;

  useEffect(() => {
    if (profiles.length === 0) {
      setScreen("onboard");
    } else {
      const key = `${activeProfileId}_${today}_${briefLength}`;
      if (!briefs[key] && activeProfileId) {
        const ap = profiles.find(p => p.id === activeProfileId);
        if (ap) {
          setScreen("brief");
          doGenerate(ap, briefLength);
        } else {
          setScreen("home");
        }
      } else {
        setScreen("brief");
      }
    }
  }, []);

  const toggleInterest = (i) =>
    setForm(f => ({ ...f, interests: f.interests.includes(i) ? f.interests.filter(x => x !== i) : [...f.interests, i] }));

  const saveProfile = () => {
    const isEditing = !!editingProfileId;
    const newProfile = isEditing ? null : { id: Date.now().toString(), ...form };
    const updated = isEditing
      ? profiles.map(p => p.id === editingProfileId ? { ...p, ...form } : p)
      : [...profiles, newProfile];
    setProfiles(updated);
    const targetId = isEditing ? editingProfileId : newProfile.id;
    setActiveProfileId(targetId);
    setEditingProfileId(null);
    setForm({ name: "", career: "", interests: [] });
    setSetupStep(0);
    const targetProfile = updated.find(p => p.id === targetId);
    setScreen("brief");
    doGenerate(targetProfile, briefLength);
  };

  const switchProfile = (id) => {
    setActiveProfileId(id);
    const p = profiles.find(pr => pr.id === id);
    const key = `${id}_${today}_${briefLength}`;
    if (p && !briefs[key]) {
      setScreen("brief");
      doGenerate(p, briefLength);
    } else {
      setScreen("brief");
    }
  };

  const deleteProfile = (id) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    if (activeProfileId === id) {
      const fallback = updated[0];
      setActiveProfileId(fallback?.id || null);
      setScreen(updated.length === 0 ? "onboard" : "brief");
    }
  };

  const doGenerate = async (profile, length) => {
    const p = profile || activeProfile;
    if (!p) return;
    setLoading(true);
    const msgs = ["Pulling today's headlines…", "Reading your profile…", "Finding what matters to you…", "Writing your brief…", "Adding perspective and context…", "Almost done…"];
    let mi = 0;
    setLoadingMsg(msgs[0]);
    const iv = setInterval(() => { mi++; if (mi < msgs.length) setLoadingMsg(msgs[mi]); }, 2200);
    const { prompt, tokens } = buildPrompt(p, length);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: tokens })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      clearInterval(iv);
      const key = `${p.id}_${today}_${length}`;
      setBriefs(prev => ({ ...prev, [key]: text }));
    } catch {
      clearInterval(iv);
    }
    setLoading(false);
  };

  const switchLength = (l) => {
    setBriefLength(l);
    const key = `${activeProfileId}_${today}_${l}`;
    if (!briefs[key] && activeProfile) doGenerate(activeProfile, l);
  };

  // ── ONBOARD ────────────────────────────────────────────────────────────────
  if (screen === "onboard") return (
    <Shell>
      <div style={S.onboardWrap}>
        <div style={S.wordmark}>DailyBriefs</div>
        <div style={S.hero}>Your morning brief,<br /><span style={{ color: ACCENT }}>built around you.</span></div>
        <div style={S.heroSub}>Tell us who you are once. Every morning, DailyBriefs generates a personalized intelligence brief shaped by your career, your goals, and the future you're building toward.</div>
        <div style={S.fGrid}>
          {[["📰","Deep daily coverage","More stories, more context — not just headlines"],
            ["🎯","Built around your goals","Your career path shapes every section, every day"],
            ["⚡","Refreshes automatically","New brief every morning without lifting a finger"],
            ["👤","Multiple profiles","Switch between your student self, investor self, operator self"]
          ].map(([icon, title, desc]) => (
            <div key={title} style={S.fCard}>
              <div style={S.fIcon}>{icon}</div>
              <div style={S.fTitle}>{title}</div>
              <div style={S.fDesc}>{desc}</div>
            </div>
          ))}
        </div>
        <button style={S.btn} onClick={() => setScreen("setup")}>Get My Brief →</button>
        <div style={S.note}>Free · No account required · 2 minutes to set up</div>
      </div>
    </Shell>
  );

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (screen === "setup") return (
    <Shell>
      <div style={S.setupWrap}>
        <div style={S.setupTop}>
          <button style={S.wordmarkBtn} onClick={() => setScreen(profiles.length > 0 ? "brief" : "onboard")}>DailyBriefs</button>
          <div style={S.dots}>{[0,1].map(i => <div key={i} style={{ ...S.dot, background: setupStep >= i ? ACCENT : "#222" }} />)}</div>
        </div>

        {setupStep === 0 && (
          <div style={S.block}>
            <div style={S.setupQ}>{editingProfileId ? "Edit your profile" : "Let's build your brief"}</div>
            <div style={S.setupHint}>The more detail you share, the sharper your brief will be.</div>
            <label style={S.label}>Your name</label>
            <input style={S.input} placeholder="What should we call you?" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <label style={S.label}>Your career & goals</label>
            <div style={S.inputHint}>Where are you working or studying now? What industries do you want to break into? What companies or roles are you aiming for?</div>
            <textarea style={{ ...S.input, minHeight: 130, resize: "vertical" }}
              placeholder="e.g. I'm a sophomore at NYU studying economics. I want to break into investment banking or VC. Long-term I want to work at a firm like Sequoia or Goldman. I'm also very interested in how AI is changing finance and what that means for careers like mine…"
              value={form.career} onChange={e => setForm(f => ({ ...f, career: e.target.value }))} />
            <button style={{ ...S.btn, opacity: form.name && form.career ? 1 : 0.35 }} disabled={!form.name || !form.career} onClick={() => setSetupStep(1)}>Continue →</button>
          </div>
        )}

        {setupStep === 1 && (
          <div style={S.block}>
            <div style={S.setupQ}>Any other areas you want to follow?</div>
            <div style={S.setupHint}>Pick topics beyond your career focus. Your brief will cover all of these daily.</div>
            <div style={S.chipGrid}>
              {INTEREST_OPTIONS.map(opt => (
                <button key={opt} style={{ ...S.chip, ...(form.interests.includes(opt) ? S.chipOn : {}) }} onClick={() => toggleInterest(opt)}>{opt}</button>
              ))}
            </div>
            <div style={S.setupNav}>
              <button style={S.ghostBtn} onClick={() => setSetupStep(0)}>← Back</button>
              <button style={S.btn} onClick={saveProfile}>{editingProfileId ? "Save →" : "Build My Brief →"}</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );

  // ── PROFILES ───────────────────────────────────────────────────────────────
  if (screen === "profiles") return (
    <Shell>
      <div style={S.profilesWrap}>
        <div style={S.navBar}>
          <div style={S.wordmark}>DailyBriefs</div>
          <button style={S.navLink} onClick={() => setScreen("brief")}>← Back to Brief</button>
        </div>
        <div style={S.pgHead}>Your Profiles</div>
        <div style={S.pgSub}>Each profile gets its own daily brief, automatically generated every morning from the perspective of who that version of you wants to become.</div>
        <div style={S.profileList}>
          {profiles.map(p => (
            <div key={p.id} style={{ ...S.profileRow, ...(p.id === activeProfileId ? S.profileRowOn : {}) }}>
              <div style={S.prLeft}>
                <div style={S.avatar}>{p.name[0].toUpperCase()}</div>
                <div>
                  <div style={S.prName}>{p.name}</div>
                  <div style={S.prSnip}>{p.career.slice(0, 90)}{p.career.length > 90 ? "…" : ""}</div>
                  {p.id === activeProfileId && <div style={S.activeBadge}>● ACTIVE</div>}
                </div>
              </div>
              <div style={S.prActions}>
                {p.id !== activeProfileId && <button style={S.smBtn} onClick={() => { switchProfile(p.id); setScreen("brief"); }}>Switch</button>}
                <button style={S.smBtn} onClick={() => { setForm({ name: p.name, career: p.career, interests: p.interests || [] }); setEditingProfileId(p.id); setSetupStep(0); setScreen("setup"); }}>Edit</button>
                {profiles.length > 1 && <button style={{ ...S.smBtn, color: "#FF6B6B", borderColor: "#FF6B6B33" }} onClick={() => deleteProfile(p.id)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
        <button style={S.btn} onClick={() => { setForm({ name: "", career: "", interests: [] }); setEditingProfileId(null); setSetupStep(0); setScreen("setup"); }}>+ Add New Profile</button>
        <div style={S.pgNote}>💡 Tip: Create a profile for each "version" of yourself — your student self, your future investor self, your operator self. Each gets a completely different brief every morning.</div>
      </div>
    </Shell>
  );

  // ── BRIEF ──────────────────────────────────────────────────────────────────
  const sections = parseBrief(currentBrief || "");

  return (
    <Shell>
      <div style={S.briefWrap}>
        {/* Nav */}
        <div style={S.navBar}>
          <div style={S.wordmark}>DailyBriefs</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.navLink} onClick={() => setScreen("profiles")}>Profiles</button>
            <button style={S.navLink} onClick={() => { setForm({ name: activeProfile?.name || "", career: activeProfile?.career || "", interests: activeProfile?.interests || [] }); setEditingProfileId(activeProfile?.id || null); setSetupStep(0); setScreen("setup"); }}>Settings</button>
          </div>
        </div>

        {/* Profile tabs */}
        {profiles.length > 1 && (
          <div style={S.tabs}>
            {profiles.map(p => (
              <button key={p.id} style={{ ...S.tab, ...(p.id === activeProfileId ? S.tabOn : {}) }} onClick={() => switchProfile(p.id)}>
                {p.name.split(" ")[0]}
              </button>
            ))}
            <button style={{ ...S.tab, marginLeft: "auto" }} onClick={() => { setForm({ name: "", career: "", interests: [] }); setEditingProfileId(null); setSetupStep(0); setScreen("setup"); }}>+ Add</button>
          </div>
        )}

        {/* Brief header */}
        <div style={S.briefHead}>
          <div style={S.briefDateStr}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</div>
          <div style={S.briefTitle}>Morning Brief</div>
          <div style={S.briefFor}>for <span style={{ color: ACCENT }}>{activeProfile?.name}</span></div>
          <div style={S.lengthRow}>
            <div style={S.lengthLabel}>Length:</div>
            {["short", "medium", "long"].map(l => (
              <button key={l} style={{ ...S.lBtn, ...(briefLength === l ? S.lBtnOn : {}) }} onClick={() => switchLength(l)}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
            <button style={S.regenBtn} onClick={() => doGenerate(activeProfile, briefLength)}>↻ Refresh</button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={S.loadWrap}>
            <div style={S.loadOrb} />
            <div style={S.loadTitle}>Generating your {briefLength} brief…</div>
            <div style={S.loadMsg}>{loadingMsg}</div>
          </div>
        ) : !currentBrief ? (
          <div style={{ paddingTop: 40 }}>
            <button style={S.btn} onClick={() => doGenerate(activeProfile, briefLength)}>Generate Brief →</button>
          </div>
        ) : (
          <>
            {sections.map((sec, idx) => {
              const { color, icon } = SECTION_META[idx % SECTION_META.length];
              const defaultOpen = idx <= 1;
              const isOpen = expandedSection === idx || (expandedSection === null && defaultOpen);
              return (
                <div key={idx} style={S.section}>
                  <button style={{ ...S.secBtn, borderLeftColor: color }} onClick={() => setExpandedSection(isOpen && !defaultOpen ? null : idx)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 15 }}>{icon}</span>
                      <span style={{ ...S.secTitle, color }}>{sec.title}</span>
                    </div>
                    <span style={{ color: "#445", fontSize: 18 }}>{isOpen ? "−" : "+"}</span>
                  </button>

                  {isOpen && (
                    <div style={S.secBody}>
                      {sec.content.join("\n").split("\n").map((line, li) => {
                        const t = line.trim();
                        if (!t) return <div key={li} style={{ height: 10 }} />;
                        if (t.startsWith("**")) {
                          return <div key={li} style={{ ...S.stHead, color }}>{t.replace(/\*\*/g, "")}</div>;
                        }
                        if (t.startsWith("•")) {
                          const rest = t.slice(1).trim();
                          const colonIdx = rest.indexOf(":");
                          return (
                            <div key={li} style={S.bullet}>
                              <span style={{ color, marginRight: 8, flexShrink: 0 }}>•</span>
                              {colonIdx > 0
                                ? <span><span style={{ color, fontWeight: 700 }}>{rest.slice(0, colonIdx)}:</span>{rest.slice(colonIdx + 1)}</span>
                                : <span>{rest}</span>}
                            </div>
                          );
                        }
                        return <div key={li} style={S.bodyLine}>{t}</div>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={S.footer}>
              <div style={S.footerNote}>Refreshes automatically every morning · {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
              <div style={S.footerBtns}>
                <button style={S.footBtn} onClick={() => doGenerate(activeProfile, briefLength)}>↻ Regenerate</button>
                <button style={S.footBtn} onClick={() => setScreen("profiles")}>Switch Profile</button>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} body{margin:0} button:hover{opacity:.82} textarea,input{outline:none} textarea::placeholder,input::placeholder{color:#2a3a4a}`}</style>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080C10", color: "#dde", fontFamily: "'Georgia','Times New Roman',serif" }}>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "0 20px" }}>
        {children}
      </div>
    </div>
  );
}

const S = {
  wordmark: { fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" },
  wordmarkBtn: { fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", background: "none", border: "none", cursor: "pointer", fontFamily: "'Georgia',serif", padding: 0 },
  navBar: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 34, paddingBottom: 6 },
  navLink: { background: "none", border: "1px solid #1e2a38", borderRadius: 8, padding: "7px 14px", color: "#556", fontSize: 13, cursor: "pointer", fontFamily: "system-ui,sans-serif" },
  btn: { background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "15px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Georgia',serif", width: "100%", transition: "opacity .15s" },
  ghostBtn: { background: "transparent", border: "1px solid #1e2a38", borderRadius: 10, padding: "14px 20px", color: "#556", fontSize: 15, cursor: "pointer", fontFamily: "'Georgia',serif" },

  // ONBOARD
  onboardWrap: { paddingTop: 60, paddingBottom: 80, display: "flex", flexDirection: "column", gap: 22 },
  hero: { fontSize: "clamp(28px,5.5vw,48px)", fontWeight: 700, lineHeight: 1.2, color: "#fff", letterSpacing: "-0.02em" },
  heroSub: { fontSize: 16, color: "#668", lineHeight: 1.75, fontFamily: "system-ui,sans-serif", maxWidth: 540 },
  fGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  fCard: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 6 },
  fIcon: { fontSize: 20 },
  fTitle: { fontSize: 14, fontWeight: 700, color: "#ccd", fontFamily: "system-ui,sans-serif" },
  fDesc: { fontSize: 12, color: "#445", lineHeight: 1.5, fontFamily: "system-ui,sans-serif" },
  note: { textAlign: "center", color: "#334", fontSize: 12, fontFamily: "system-ui,sans-serif" },

  // SETUP
  setupWrap: { paddingTop: 40, paddingBottom: 80 },
  setupTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 44 },
  dots: { display: "flex", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: "50%", transition: "background .3s" },
  block: { display: "flex", flexDirection: "column", gap: 14 },
  setupQ: { fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" },
  setupHint: { fontSize: 14, color: "#556", lineHeight: 1.6, fontFamily: "system-ui,sans-serif" },
  label: { fontSize: 11, fontWeight: 700, color: "#445", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "system-ui,sans-serif" },
  inputHint: { fontSize: 13, color: "#445", lineHeight: 1.5, fontFamily: "system-ui,sans-serif", marginTop: -6 },
  input: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 10, padding: "13px 15px", color: "#dde", fontSize: 14, fontFamily: "system-ui,sans-serif", width: "100%", lineHeight: 1.6 },
  chipGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 20, padding: "8px 14px", color: "#667", fontSize: 13, cursor: "pointer", fontFamily: "system-ui,sans-serif", transition: "all .12s" },
  chipOn: { background: `${ACCENT}18`, border: `1px solid ${ACCENT}`, color: ACCENT },
  setupNav: { display: "flex", gap: 10 },

  // PROFILES
  profilesWrap: { paddingBottom: 80, display: "flex", flexDirection: "column", gap: 18 },
  pgHead: { fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginTop: 8 },
  pgSub: { fontSize: 14, color: "#557", lineHeight: 1.65, fontFamily: "system-ui,sans-serif" },
  profileList: { display: "flex", flexDirection: "column", gap: 10 },
  profileRow: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  profileRowOn: { border: `1px solid ${ACCENT}55`, background: `${ACCENT}07` },
  prLeft: { display: "flex", gap: 14, alignItems: "flex-start", flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: "50%", background: `${ACCENT}22`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 },
  prName: { fontSize: 15, fontWeight: 700, color: "#dde", marginBottom: 3 },
  prSnip: { fontSize: 12, color: "#445", lineHeight: 1.5, fontFamily: "system-ui,sans-serif" },
  activeBadge: { fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: "0.15em", marginTop: 5, fontFamily: "system-ui,sans-serif" },
  prActions: { display: "flex", gap: 6, flexShrink: 0 },
  smBtn: { background: "none", border: "1px solid #1e2a38", borderRadius: 7, padding: "6px 12px", color: "#556", fontSize: 12, cursor: "pointer", fontFamily: "system-ui,sans-serif" },
  pgNote: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#445", lineHeight: 1.65, fontFamily: "system-ui,sans-serif" },

  // BRIEF
  briefWrap: { paddingBottom: 100 },
  tabs: { display: "flex", gap: 6, paddingTop: 12, paddingBottom: 4, overflowX: "auto" },
  tab: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 20, padding: "7px 16px", color: "#556", fontSize: 13, cursor: "pointer", fontFamily: "system-ui,sans-serif", whiteSpace: "nowrap" },
  tabOn: { background: `${ACCENT}18`, border: `1px solid ${ACCENT}`, color: ACCENT },
  briefHead: { paddingTop: 28, paddingBottom: 24, borderBottom: "1px solid #0e1318", marginBottom: 4 },
  briefDateStr: { fontSize: 11, color: "#334", letterSpacing: "0.15em", fontFamily: "system-ui,sans-serif", marginBottom: 10 },
  briefTitle: { fontSize: 40, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.05 },
  briefFor: { fontSize: 16, color: "#445", fontFamily: "system-ui,sans-serif", marginTop: 6, marginBottom: 20 },
  lengthRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  lengthLabel: { fontSize: 12, color: "#445", fontFamily: "system-ui,sans-serif", marginRight: 2 },
  lBtn: { background: "#0D1218", border: "1px solid #1a2230", borderRadius: 8, padding: "7px 14px", color: "#445", fontSize: 12, cursor: "pointer", fontFamily: "system-ui,sans-serif" },
  lBtnOn: { background: `${ACCENT}18`, border: `1px solid ${ACCENT}`, color: ACCENT },
  regenBtn: { background: "none", border: "1px solid #1a2230", borderRadius: 8, padding: "7px 14px", color: "#334", fontSize: 12, cursor: "pointer", fontFamily: "system-ui,sans-serif", marginLeft: "auto" },
  loadWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 70, paddingBottom: 70 },
  loadOrb: { width: 44, height: 44, border: "3px solid #1a2030", borderTop: `3px solid ${ACCENT}`, borderRadius: "50%", animation: "spin .9s linear infinite" },
  loadTitle: { fontSize: 18, fontWeight: 700, color: "#ccd" },
  loadMsg: { fontSize: 14, color: "#445", fontFamily: "system-ui,sans-serif" },
  section: { borderBottom: "1px solid #0e1318" },
  secBtn: { width: "100%", background: "none", border: "none", borderLeft: "3px solid", padding: "20px 0 20px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" },
  secTitle: { fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", fontFamily: "system-ui,sans-serif" },
  secBody: { padding: "4px 20px 28px 23px", borderLeft: "3px solid #0e1318" },
  stHead: { fontSize: 15, fontWeight: 700, marginTop: 18, marginBottom: 6, lineHeight: 1.4, fontFamily: "'Georgia',serif" },
  bodyLine: { fontSize: 15, color: "#889", lineHeight: 1.8, fontFamily: "system-ui,sans-serif", marginBottom: 1 },
  bullet: { fontSize: 14, color: "#778", lineHeight: 1.7, fontFamily: "system-ui,sans-serif", display: "flex", marginBottom: 8 },
  footer: { paddingTop: 40, paddingBottom: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
  footerNote: { fontSize: 12, color: "#334", fontFamily: "system-ui,sans-serif", letterSpacing: "0.04em" },
  footerBtns: { display: "flex", gap: 8 },
  footBtn: { background: "none", border: "1px solid #1a2230", borderRadius: 8, padding: "9px 18px", color: "#445", fontSize: 13, cursor: "pointer", fontFamily: "system-ui,sans-serif" },
};
