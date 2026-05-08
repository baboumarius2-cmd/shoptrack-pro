import { useState, useEffect, useCallback } from "react";

/* ══════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════ */
const COMMUNES_ABIDJAN = ["Cocody","Yopougon","Marcory","Plateau","Adjamé","Abobo","Treichville","Port-Bouët","Koumassi","Attécoubé","Bingerville","Anyama"];
const MOTIFS = ["Client injoignable","Adresse introuvable","Client absent","Commande annulée","Reporter à date choisie","Autre"];
const COMMUNE_COLORS = {Cocody:"#818cf8",Yopougon:"#a78bfa",Marcory:"#f472b6",Plateau:"#fbbf24",Adjamé:"#34d399",Abobo:"#60a5fa",Treichville:"#f87171","Port-Bouët":"#2dd4bf",Koumassi:"#fb923c",Attécoubé:"#a3e635"};
const TAG_CONFIG = {vip:{label:"⭐ VIP",color:"#f59e0b"},fidele:{label:"♻️ Fidèle",color:"#818cf8"},nouveau:{label:"🆕 Nouveau",color:"#10b981"}};
const CAT_DEP = [{id:"emballage",label:"📦 Emballages",color:"#f59e0b"},{id:"transport",label:"🚗 Transport",color:"#3b82f6"},{id:"publicite",label:"📱 Publicité",color:"#8b5cf6"},{id:"achat",label:"🛒 Achat produits",color:"#10b981"},{id:"salaire",label:"👤 Salaire",color:"#ec4899"},{id:"autre",label:"🔧 Autre",color:"#6b7280"}];

function getCategorie(c){return !c||c==="Inconnu"?"autre":COMMUNES_ABIDJAN.includes(c)?"abidjan":"hors_abidjan";}
function getBadgeColor(c){if(!c||c==="Inconnu")return"#52525b";if(!COMMUNES_ABIDJAN.includes(c))return"#ef4444";return COMMUNE_COLORS[c]||"#818cf8";}
function getCatDep(id){return CAT_DEP.find(c=>c.id===id)||CAT_DEP[5];}
const today = new Date().toISOString().split("T")[0];

/* ══════════════════════════════════════════
   STYLES HELPERS
══════════════════════════════════════════ */
const IS = {width:"100%",padding:"10px 13px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"#1a1a1a",color:"white",fontSize:13,fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box",outline:"none"};
function Chip({c,children}){return <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:c+"18",color:c,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>;}
function Btn({color,onClick,children,full,disabled}){return <button disabled={disabled} onClick={onClick} style={{padding:"7px 12px",borderRadius:8,border:"none",cursor:disabled?"default":"pointer",background:disabled?"#1a1a1a":color+"18",color:disabled?"#525252":color,fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif",width:full?"100%":"auto",opacity:disabled?0.5:1}}>{children}</button>;}
function CB({onClick,label}){return <button onClick={onClick} style={{flex:1,padding:12,borderRadius:10,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#525252",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{label||"Annuler"}</button>;}
function BS({children,onClose,border}){return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}} onClick={onClose}><div style={{background:"#0e0e0e",borderRadius:"22px 22px 0 0",padding:24,width:"100%",maxWidth:520,border:`1px solid ${border||"rgba(255,255,255,0.1)"}`,borderBottom:"none",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div></div>);}
function Loader({text}){return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,gap:16}}><div style={{width:40,height:40,border:"3px solid rgba(245,158,11,0.2)",borderTop:"3px solid #f59e0b",borderRadius:"50%",animation:"spin 1s linear infinite"}}/><div style={{color:"#525252",fontSize:13}}>{text||"Chargement..."}</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;}

/* ══════════════════════════════════════════
   APP PRINCIPALE
══════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("login"); // login | setup | app
  const [role, setRole] = useState(null);
  const [loginRole, setLoginRole] = useState(null);
  const [loginPwd, setLoginPwd] = useState("");
  const [loginError, setLoginError] = useState("");
  const [setupPwd, setSetupPwd] = useState("");
  const [setupPwd2, setSetupPwd2] = useState("");
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);

  // App state
  const [orders, setOrders] = useState([]);
  const [savedOrders, setSavedOrders] = useState({});
  const [products, setProducts] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [settings, setSettings] = useState({});
  const [tab, setTab] = useState("commandes");
  const [modal, setModal] = useState(null);
  const [motifSel, setMotifSel] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [bilanMode, setBilanMode] = useState("jour");
  const [bilanDate, setBilanDate] = useState(today);
  const [bilanProduit, setBilanProduit] = useState("tous");
  const [clientSearch, setClientSearch] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("tous");
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [depFilter, setDepFilter] = useState("tout");
  const [showAddDep, setShowAddDep] = useState(false);
  const [newDep, setNewDep] = useState({libelle:"",montant:"",categorie:"emballage",date:today,note:""});
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({client:"",phone:"",produitId:"",qte:"1",commune:"Cocody",note:""});
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msgTemplate, setMsgTemplate] = useState("Bonjour {nom} 👋\n\nMerci pour votre commande !\n📦 {produit}\n💰 {prix} FCFA\n\nVotre commande sera livrée aujourd'hui. Merci de rester disponible. 🙏");

  const isPatron = role === "patron";
  const accent = isPatron ? "#f59e0b" : "#ec4899";

  // Merge Shopify orders with saved local statuses
  const mergedOrders = orders.map(o => ({
    ...o,
    ...(savedOrders[o.shopifyId] || {}),
  }));

  const todayOrders = mergedOrders.filter(o => o.date === today);
  const abidjanO = todayOrders.filter(o => getCategorie(o.commune) === "abidjan");
  const horsO = todayOrders.filter(o => getCategorie(o.commune) === "hors_abidjan");
  const autreO = todayOrders.filter(o => getCategorie(o.commune) === "autre");
  const reportees = mergedOrders.filter(o => o.statut === "reportee");
  const livreesToday = todayOrders.filter(o => o.statut === "livree");
  const enAttenteToday = todayOrders.filter(o => o.statut === "en_attente");

  /* ── Load data ── */
  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [sRes, oRes, dRes, pRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/orders"),
        fetch("/api/depenses"),
        fetch("/api/products"),
      ]);
      const s = await sRes.json();
      const o = await oRes.json();
      const d = await dRes.json();
      const p = await pRes.json();
      setSettings(s);
      setSavedOrders(o);
      setDepenses(Array.isArray(d) ? d : []);
      if (p.products) setProducts(p.products);
      if (s.msgTemplate) setMsgTemplate(s.msgTemplate);
    } catch {}
    setRefreshing(false);
  }, []);

  const loadShopifyOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/shopify");
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (screen === "app") {
      loadAll();
      loadShopifyOrders();
    }
  }, [screen]);

  /* ── Auth ── */
  async function handleLogin() {
    if (!loginPwd) return;
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ action: "login", role: loginRole, password: loginPwd }),
      });
      const data = await res.json();
      if (data.success) {
        setRole(loginRole);
        setScreen("app");
        setLoginPwd("");
      } else if (data.error === "no_password") {
        setScreen("setup");
      } else {
        setLoginError(data.error || "Mot de passe incorrect");
      }
    } catch { setLoginError("Erreur de connexion"); }
    setLoading(false);
  }

  async function handleSetup() {
    if (!setupPwd || setupPwd.length < 4) return setSetupError("Minimum 4 caractères");
    if (setupPwd !== setupPwd2) return setSetupError("Les mots de passe ne correspondent pas");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ action: "setup", role: loginRole, newPassword: setupPwd }),
      });
      const data = await res.json();
      if (data.success) {
        setRole(loginRole);
        setScreen("app");
        setSetupPwd(""); setSetupPwd2(""); setSetupError("");
      } else {
        setSetupError(data.error);
      }
    } catch { setSetupError("Erreur"); }
    setLoading(false);
  }

  /* ── Order actions ── */
  async function updateOrder(shopifyId, updates) {
    setSavedOrders(p => ({...p, [shopifyId]: {...(p[shopifyId]||{}), ...updates}}));
    await fetch("/api/orders", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ orderId: shopifyId, updates }),
    });
  }

  function doLivrer(order) {
    updateOrder(order.shopifyId, { statut: "livree" });
    setModal(null);
  }

  function doMotif(order) {
    const isRep = motifSel === "Reporter à date choisie";
    updateOrder(order.shopifyId, {
      statut: isRep ? "reportee" : "non_livree",
      motif: motifSel,
      ...(isRep && reportDate ? { reportDate } : {}),
    });
    setModal(null); setMotifSel(""); setReportDate("");
  }

  function openWA(order) {
    const msg = msgTemplate
      .replace("{nom}", order.client)
      .replace("{produit}", order.produit)
      .replace("{prix}", order.prix?.toLocaleString() || "");
    setWaMsg(msg);
    setModal({ type: "whatsapp", order });
  }

  function sendWA(order) {
    const phone = order.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, "_blank");
    const contacted = [...(order.contacted || [])];
    if (!contacted.includes("whatsapp")) contacted.push("whatsapp");
    updateOrder(order.shopifyId, { contacted });
    setModal(null);
  }

  function callClient(order) {
    window.open(`tel:+${order.phone.replace(/\D/g,"")}`, "_blank");
    const contacted = [...(order.contacted || [])];
    if (!contacted.includes("appel")) contacted.push("appel");
    updateOrder(order.shopifyId, { contacted });
  }

  function sendSMS(order) {
    window.open(`sms:+${order.phone.replace(/\D/g,"")}`, "_blank");
    const contacted = [...(order.contacted || [])];
    if (!contacted.includes("sms")) contacted.push("sms");
    updateOrder(order.shopifyId, { contacted });
  }

  function doTransfer(order) {
    const livreurPhone = settings.livreurPhone || "";
    updateOrder(order.shopifyId, { transferred: true });
    if (livreurPhone) {
      const msg = `📦 Nouvelle livraison\n\nClient: ${order.client}\nTél: ${order.phone}\nAdresse: ${order.adresse || order.commune}\nProduit: ${order.produit}\n\nMerci ✅`;
      window.open(`https://wa.me/${livreurPhone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  }

  /* ── Add manual order ── */
  async function addOrderManual() {
    if (!newOrder.client || !newOrder.phone) return;
    const prod = products.find(p => p.id === newOrder.produitId) || {};
    const id = "MANUEL-" + Date.now();
    const cmd = {
      id: "#M" + Date.now().toString().slice(-4),
      shopifyId: id,
      client: newOrder.client,
      phone: newOrder.phone.replace(/\D/g,""),
      produit: prod.nom ? `${prod.nom} ×${newOrder.qte}` : "Produit Manuel",
      prix: (prod.prixVente || 0) * (+newOrder.qte || 1),
      commune: newOrder.commune,
      adresse: newOrder.commune,
      livraison: 2000,
      statut: "en_attente",
      date: today,
      heure: new Date().toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"}),
      contacted: [],
      transferred: false,
      note: newOrder.note,
      motif: "",
      reportDate: "",
      isManual: true,
    };
    setOrders(p => [cmd, ...p]);
    await fetch("/api/orders", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ orderId: id, updates: cmd }),
    });
    setNewOrder({client:"",phone:"",produitId:"",qte:"1",commune:"Cocody",note:""});
    setShowAddOrder(false);
  }

  /* ── Depenses ── */
  async function addDepense() {
    if (!newDep.libelle || !newDep.montant) return;
    const dep = {...newDep, montant: +newDep.montant};
    await fetch("/api/depenses", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ action: "add", depense: dep }),
    });
    setDepenses(p => [{...dep, id:"D"+Date.now()}, ...p]);
    setNewDep({libelle:"",montant:"",categorie:"emballage",date:today,note:""});
    setShowAddDep(false);
  }

  async function deleteDepense(id) {
    await fetch("/api/depenses", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ action: "delete", depense: {id} }),
    });
    setDepenses(p => p.filter(d => d.id !== id));
  }

  /* ── Settings save ── */
  async function saveSettings(updates) {
    const merged = {...settings, ...updates};
    setSettings(merged);
    await fetch("/api/settings", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(updates),
    });
  }

  /* ══════════════════════════════════════════
     LOGIN SCREEN
  ══════════════════════════════════════════ */
  if (screen === "login" && !loginRole) return (
    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{textAlign:"center",maxWidth:360,width:"100%"}}>
        <div style={{width:80,height:80,borderRadius:24,background:"linear-gradient(135deg,#f59e0b,#ef4444)",margin:"0 auto 24px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,boxShadow:"0 0 60px rgba(245,158,11,0.3)"}}>⌚</div>
        <h1 style={{fontSize:28,fontWeight:800,color:"white",letterSpacing:"-1px",marginBottom:6}}>ShopTrack Pro</h1>
        <p style={{color:"#404040",fontSize:13,marginBottom:48}}>Yah-ni · Gestion commandes</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[{r:"patron",icon:"👑",label:"Patron",sub:"Accès complet",grad:"linear-gradient(160deg,#f59e0b,#ef4444)"},{r:"assistante",icon:"👩‍💼",label:"Assistante",sub:"Commandes & livraisons",grad:"linear-gradient(160deg,#ec4899,#8b5cf6)"}].map(({r,icon,label,sub,grad})=>(
            <button key={r} onClick={()=>setLoginRole(r)} style={{padding:"24px 16px",borderRadius:20,border:"1px solid rgba(255,255,255,0.06)",cursor:"pointer",background:"#111",color:"white",fontFamily:"'DM Sans',sans-serif",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:grad,opacity:0.12}}/>
              <div style={{fontSize:32,marginBottom:8}}>{icon}</div>
              <div style={{fontSize:16,fontWeight:700}}>{label}</div>
              <div style={{fontSize:11,color:"#666",marginTop:3}}>{sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (screen === "login" && loginRole) return (
    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{maxWidth:360,width:"100%"}}>
        <button onClick={()=>{setLoginRole(null);setLoginPwd("");setLoginError("");}} style={{color:"#525252",background:"none",border:"none",cursor:"pointer",fontSize:13,marginBottom:24,fontFamily:"'DM Sans',sans-serif"}}>← Retour</button>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>{loginRole==="patron"?"👑":"👩‍💼"}</div>
          <h2 style={{fontSize:22,fontWeight:800,color:"white",marginBottom:4}}>{loginRole==="patron"?"Patron":"Assistante"}</h2>
          <p style={{color:"#525252",fontSize:13}}>Entrez votre mot de passe</p>
        </div>
        <input type="password" value={loginPwd} onChange={e=>{setLoginPwd(e.target.value);setLoginError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="Mot de passe" style={{...IS,fontSize:16,padding:"14px 16px",marginBottom:12,textAlign:"center",letterSpacing:4}}/>
        {loginError && <div style={{color:"#f87171",fontSize:12,textAlign:"center",marginBottom:12}}>{loginError}</div>}
        <button onClick={handleLogin} disabled={loading||!loginPwd} style={{width:"100%",padding:14,borderRadius:12,border:"none",cursor:loginPwd&&!loading?"pointer":"default",background:loginPwd&&!loading?`linear-gradient(135deg,${loginRole==="patron"?"#f59e0b,#ef4444":"#ec4899,#8b5cf6"})`:"#1a1a1a",color:loginPwd&&!loading?"white":"#525252",fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
          {loading?"Connexion...":"Se connecter"}
        </button>
      </div>
    </div>
  );

  if (screen === "setup") return (
    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{maxWidth:360,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <h2 style={{fontSize:22,fontWeight:800,color:"white",marginBottom:4}}>Créer votre mot de passe</h2>
          <p style={{color:"#525252",fontSize:13}}>Première connexion en tant que {loginRole}</p>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#525252",marginBottom:5}}>Nouveau mot de passe (min. 4 caractères)</div>
          <input type="password" value={setupPwd} onChange={e=>{setSetupPwd(e.target.value);setSetupError("");}} placeholder="••••••••" style={{...IS,fontSize:16,padding:"14px",letterSpacing:4}}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"#525252",marginBottom:5}}>Confirmer le mot de passe</div>
          <input type="password" value={setupPwd2} onChange={e=>{setSetupPwd2(e.target.value);setSetupError("");}} onKeyDown={e=>e.key==="Enter"&&handleSetup()} placeholder="••••••••" style={{...IS,fontSize:16,padding:"14px",letterSpacing:4}}/>
        </div>
        {setupError && <div style={{color:"#f87171",fontSize:12,textAlign:"center",marginBottom:12}}>{setupError}</div>}
        <button onClick={handleSetup} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"white",fontSize:15,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
          {loading?"Création...":"Créer le mot de passe"}
        </button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════
     ORDER CARD
  ══════════════════════════════════════════ */
  const OrderCard = ({order}) => {
    const merged = {...order, ...(savedOrders[order.shopifyId]||{})};
    const isLivree=merged.statut==="livree", isBad=merged.statut==="non_livree", isRep=merged.statut==="reportee";
    const contacted = merged.contacted||[];
    return (
      <div style={{background:"#111",borderRadius:14,padding:"14px 16px",border:`1px solid ${isLivree?"rgba(52,211,153,0.25)":isBad?"rgba(239,68,68,0.2)":isRep?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.06)"}`,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"#404040",fontFamily:"monospace"}}>{merged.id}</span>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:getBadgeColor(merged.commune)+"22",color:getBadgeColor(merged.commune),fontWeight:600}}>{merged.commune}</span>
              {merged.isManual&&<Chip c="#ec4899">✍️ Manuel</Chip>}
            </div>
            <div style={{color:"white",fontWeight:700,fontSize:15,marginBottom:3}}>{merged.client}</div>
            <div style={{color:"#737373",fontSize:12,marginBottom:4}}>📦 {merged.produit}</div>
            {isPatron && <div style={{fontSize:12,color:"#10b981",fontWeight:600}}>{merged.prix?.toLocaleString()} F · net {((merged.prix||0)-merged.livraison).toLocaleString()} F</div>}
            {merged.note&&<div style={{fontSize:11,color:"#525252",marginTop:3}}>📝 {merged.note}</div>}
            {merged.motif&&<div style={{fontSize:11,color:"#737373",marginTop:3}}>Motif: {merged.motif}</div>}
            {merged.reportDate&&<div style={{fontSize:11,color:"#fbbf24",marginTop:2}}>📅 Reporté au {merged.reportDate}</div>}
          </div>
          <div style={{textAlign:"right",marginLeft:8}}>
            <div style={{fontSize:10,color:"#404040"}}>🕐 {merged.heure}</div>
            <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
              {isLivree&&<Chip c="#34d399">✓ Livré</Chip>}
              {isBad&&<Chip c="#f87171">✗ Échoué</Chip>}
              {isRep&&<Chip c="#fbbf24">⏰ Reporté</Chip>}
            </div>
          </div>
        </div>
        {/* Contact badges */}
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {contacted.includes("whatsapp")&&<Chip c="#25d366">💬 WA</Chip>}
          {contacted.includes("sms")&&<Chip c="#60a5fa">📱 SMS</Chip>}
          {contacted.includes("appel")&&<Chip c="#a78bfa">📞 Appelé</Chip>}
          {merged.transferred&&<Chip c="#f59e0b">📤 Transféré</Chip>}
        </div>
        {/* Actions */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:merged.statut==="en_attente"?10:0}}>
          <button onClick={()=>callClient(merged)} style={{padding:"7px 11px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(167,139,250,0.15)",color:"#a78bfa",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>📞 Appeler</button>
          <Btn color="#25d366" onClick={()=>openWA(merged)}>💬 WhatsApp</Btn>
          <Btn color="#60a5fa" onClick={()=>{window.open(`sms:+${merged.phone}`,"_blank");sendSMS(merged);}}>📱 SMS</Btn>
          {!merged.transferred
            ?<Btn color="#f59e0b" onClick={()=>doTransfer(merged)}>📤 Livreur</Btn>
            :<span style={{fontSize:10,color:"#f59e0b",fontWeight:600,padding:"7px 0"}}>✓ Transféré</span>}
        </div>
        {merged.statut==="en_attente"&&(
          <div style={{display:"flex",gap:8,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
            <button onClick={()=>setModal({type:"livrer",order:merged})} style={{flex:1,padding:"11px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(52,211,153,0.12)",color:"#34d399",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>✓ Marquer Livré</button>
            <button onClick={()=>setModal({type:"motif",order:merged})} style={{flex:1,padding:"11px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(248,113,113,0.12)",color:"#f87171",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>✗ Non livré</button>
          </div>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════
     BILAN TAB
  ══════════════════════════════════════════ */
  const BilanTab = () => {
    const subset = bilanMode==="jour"?mergedOrders.filter(o=>o.date===today):bilanMode==="date"?mergedOrders.filter(o=>o.date===bilanDate):bilanMode==="produit"&&bilanProduit!=="tous"?mergedOrders.filter(o=>o.produit?.includes(bilanProduit)):mergedOrders;
    const depSubset = bilanMode==="jour"?depenses.filter(d=>d.date===today):bilanMode==="date"?depenses.filter(d=>d.date===bilanDate):depenses;
    const livrees=subset.filter(o=>o.statut==="livree");
    const encaisse=livrees.reduce((s,o)=>s+(o.prix||0),0);
    const frais=livrees.reduce((s,o)=>s+o.livraison,0);
    const brut=encaisse-frais;
    const totalDep=depSubset.reduce((s,d)=>s+d.montant,0);
    const reelNet=brut-totalDep;
    const taux=subset.length>0?Math.round(livrees.length/subset.length*100):0;
    const depParCat=CAT_DEP.map(cat=>({...cat,total:depSubset.filter(d=>d.categorie===cat.id).reduce((s,d)=>s+d.montant,0)})).filter(c=>c.total>0);
    return(
      <div>
        <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
          {[{id:"jour",l:"Aujourd'hui"},{id:"global",l:"Global"},{id:"date",l:"Par date"},{id:"produit",l:"Par produit"}].map(({id,l})=>(
            <button key={id} onClick={()=>setBilanMode(id)} style={{padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",background:bilanMode===id?"#f59e0b":"#1a1a1a",color:bilanMode===id?"#080808":"#737373",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{l}</button>
          ))}
        </div>
        {bilanMode==="date"&&<input type="date" value={bilanDate} onChange={e=>setBilanDate(e.target.value)} style={{...IS,marginBottom:16,width:"auto"}}/>}
        {bilanMode==="produit"&&<div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}><button onClick={()=>setBilanProduit("tous")} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",background:bilanProduit==="tous"?"#f59e0b":"#1a1a1a",color:bilanProduit==="tous"?"#080808":"#737373",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Tous</button>{products.map(p=><button key={p.id} onClick={()=>setBilanProduit(p.nom)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",background:bilanProduit===p.nom?"#f59e0b":"#1a1a1a",color:bilanProduit===p.nom?"#080808":"#737373",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{p.nom}</button>)}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[{l:"Encaissé",v:encaisse.toLocaleString()+" F",c:"#fbbf24",icon:"💰"},{l:"Part livreur",v:"-"+frais.toLocaleString()+" F",c:"#f87171",icon:"🛵"},{l:"Bénéfice brut",v:brut.toLocaleString()+" F",c:"#34d399",icon:"📈"},{l:"Commandes",v:subset.length,c:"#818cf8",icon:"📦"}].map(({l,v,c,icon})=>(
            <div key={l} style={{background:"#111",borderRadius:16,padding:16,border:`1px solid ${c}18`,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-8,right:-8,fontSize:36,opacity:0.07}}>{icon}</div>
              <div style={{fontSize:10,color:"#525252",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{l}</div>
              <div style={{fontSize:19,fontWeight:800,color:c}}>{v}</div>
            </div>
          ))}
        </div>
        {/* Dépenses dans le bilan */}
        <div style={{background:"#111",borderRadius:16,padding:18,border:"1px solid rgba(239,68,68,0.2)",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div><div style={{fontSize:11,color:"#525252",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>📉 Dépenses</div><div style={{fontSize:22,fontWeight:800,color:"#f87171"}}>-{totalDep.toLocaleString()} F</div></div>
            <button onClick={()=>setTab("depenses")} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(239,68,68,0.12)",color:"#f87171",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Voir tout →</button>
          </div>
          {depParCat.map(cat=><div key={cat.id} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"#737373"}}>{cat.label}</span><span style={{fontSize:12,fontWeight:700,color:cat.color}}>-{cat.total.toLocaleString()} F</span></div>)}
          {depParCat.length===0&&<div style={{fontSize:12,color:"#404040"}}>Aucune dépense</div>}
        </div>
        {/* Résultat réel */}
        <div style={{background:`linear-gradient(135deg,${reelNet>=0?"rgba(52,211,153,0.1)":"rgba(239,68,68,0.1)"},transparent)`,borderRadius:16,padding:20,border:`1px solid ${reelNet>=0?"rgba(52,211,153,0.3)":"rgba(239,68,68,0.3)"}`,marginBottom:16}}>
          <div style={{fontSize:11,color:"#525252",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>🎯 Résultat réel</div>
          <div style={{fontSize:32,fontWeight:800,color:reelNet>=0?"#34d399":"#f87171",letterSpacing:"-1px"}}>{reelNet>=0?"+":""}{reelNet.toLocaleString()} F</div>
          <div style={{fontSize:11,color:"#525252",marginTop:6}}>Brut {brut.toLocaleString()} F − Dépenses {totalDep.toLocaleString()} F</div>
        </div>
        {/* Donut taux */}
        <div style={{background:"#111",borderRadius:16,padding:20,border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:20}}>
          <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
            <svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="none" stroke="#1e1e1e" strokeWidth="9"/><circle cx="40" cy="40" r="30" fill="none" stroke={taux>70?"#34d399":taux>40?"#fbbf24":"#f87171"} strokeWidth="9" strokeDasharray={`${taux*1.885} 188.5`} strokeDashoffset="47.1" strokeLinecap="round"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:"white"}}>{taux}%</div>
          </div>
          <div><div style={{fontWeight:700,fontSize:14,color:"white",marginBottom:8}}>Taux de livraison</div><div style={{display:"flex",gap:14}}><div><div style={{fontSize:18,fontWeight:800,color:"#34d399"}}>{livrees.length}</div><div style={{fontSize:10,color:"#525252"}}>Livrées</div></div><div><div style={{fontSize:18,fontWeight:800,color:"#f87171"}}>{subset.filter(o=>o.statut==="non_livree").length}</div><div style={{fontSize:10,color:"#525252"}}>Échouées</div></div><div><div style={{fontSize:18,fontWeight:800,color:"#737373"}}>{subset.length}</div><div style={{fontSize:10,color:"#525252"}}>Total</div></div></div></div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════
     STOCK TAB (assistante - qté seulement)
  ══════════════════════════════════════════ */
  const StockTab = () => (
    <div>
      <div style={{background:"rgba(236,72,153,0.06)",borderRadius:12,padding:"10px 14px",border:"1px solid rgba(236,72,153,0.12)",marginBottom:14,fontSize:12,color:"#9ca3af"}}>👁️ Vue quantités uniquement</div>
      {products.length===0?<div style={{textAlign:"center",color:"#404040",padding:40}}>Aucun produit trouvé</div>:products.map(p=>{
        const vendu=p.stockInit-p.stockActuel; const pct=p.stockInit>0?Math.round(vendu/p.stockInit*100):0; const alerte=p.stockActuel<=10;
        return(<div key={p.id} style={{background:"#111",borderRadius:14,padding:16,border:`1px solid ${alerte?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.06)"}`,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{color:"white",fontWeight:700,fontSize:14}}>{p.nom}</div><div style={{fontSize:11,color:"#525252"}}>{p.categorie}</div></div>
            {alerte&&<span style={{fontSize:10,color:"#ef4444",fontWeight:700,background:"rgba(239,68,68,0.12)",padding:"3px 10px",borderRadius:20}}>⚠️ Stock bas</span>}
          </div>
          <div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"#525252"}}>Progression</span><span style={{fontSize:11,color:"#737373"}}>{pct}%</span></div><div style={{background:"#1a1a1a",borderRadius:20,height:8,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:alerte?"linear-gradient(90deg,#ef4444,#f97316)":pct>70?"linear-gradient(90deg,#f59e0b,#ef4444)":"linear-gradient(90deg,#34d399,#3b82f6)",borderRadius:20}}/></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{l:"Vendus",v:vendu,c:"#34d399"},{l:"En stock",v:p.stockActuel,c:alerte?"#ef4444":"white"},{l:"Initial",v:p.stockInit,c:"#525252"}].map(({l,v,c})=>(<div key={l} style={{background:"#1a1a1a",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:"#404040",marginTop:2}}>{l}</div></div>))}
          </div>
        </div>);
      })}
    </div>
  );

  /* ══════════════════════════════════════════
     PRODUITS TAB (patron)
  ══════════════════════════════════════════ */
  const ProduitsTab = () => (
    <div>
      <div style={{fontSize:12,color:"#525252",marginBottom:14}}>Produits synchronisés depuis Shopify — <button onClick={loadShopifyOrders} style={{color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>Actualiser</button></div>
      {products.length===0?<Loader text="Chargement des produits Shopify..."/>:products.map(p=>{
        const vendu=p.stockInit-p.stockActuel; const pct=p.stockInit>0?Math.round(vendu/p.stockInit*100):0; const alerte=p.stockActuel<=10;
        return(<div key={p.id} style={{background:"#111",borderRadius:14,padding:16,border:`1px solid ${alerte?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.06)"}`,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            {p.image?<img src={p.image} alt={p.nom} style={{width:44,height:44,borderRadius:10,objectFit:"cover"}}/>:<div style={{width:44,height:44,borderRadius:12,background:"rgba(245,158,11,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📦</div>}
            <div style={{flex:1}}>
              <div style={{color:"white",fontWeight:700,fontSize:14}}>{p.nom}</div>
              <div style={{fontSize:11,color:"#525252"}}>{p.categorie} · Vente: {p.prixVente.toLocaleString()} F</div>
            </div>
            {alerte&&<span style={{fontSize:10,color:"#ef4444",fontWeight:700,background:"rgba(239,68,68,0.12)",padding:"2px 8px",borderRadius:20}}>⚠️</span>}
          </div>
          <div style={{marginBottom:10}}><div style={{background:"#1a1a1a",borderRadius:20,height:7,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:alerte?"linear-gradient(90deg,#ef4444,#f97316)":pct>70?"linear-gradient(90deg,#f59e0b,#ef4444)":"linear-gradient(90deg,#34d399,#3b82f6)",borderRadius:20}}/></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{l:"Vendus",v:vendu,c:"#34d399"},{l:"Restant",v:p.stockActuel,c:alerte?"#ef4444":"white"},{l:"Initial",v:p.stockInit,c:"#525252"}].map(({l,v,c})=>(<div key={l} style={{background:"#1a1a1a",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:"#404040",marginTop:2}}>{l}</div></div>))}
          </div>
        </div>);
      })}
    </div>
  );

  /* ══════════════════════════════════════════
     DÉPENSES TAB
  ══════════════════════════════════════════ */
  const DepensesTab = () => {
    const filtered=depenses.filter(d=>depFilter==="tout"||d.categorie===depFilter);
    return(<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{background:"#111",borderRadius:14,padding:14,border:"1px solid rgba(239,68,68,0.2)"}}><div style={{fontSize:10,color:"#525252",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Aujourd'hui</div><div style={{fontSize:20,fontWeight:800,color:"#f87171"}}>-{depenses.filter(d=>d.date===today).reduce((s,d)=>s+d.montant,0).toLocaleString()} F</div></div>
        <div style={{background:"#111",borderRadius:14,padding:14,border:"1px solid rgba(239,68,68,0.15)"}}><div style={{fontSize:10,color:"#525252",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Total</div><div style={{fontSize:20,fontWeight:800,color:"#f87171"}}>-{depenses.reduce((s,d)=>s+d.montant,0).toLocaleString()} F</div></div>
      </div>
      <button onClick={()=>setShowAddDep(true)} style={{width:"100%",padding:"12px",borderRadius:14,border:"2px dashed rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.06)",color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:16,fontFamily:"'DM Sans',sans-serif"}}>➕ Saisir une dépense</button>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        <button onClick={()=>setDepFilter("tout")} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",background:depFilter==="tout"?"#f87171":"#1a1a1a",color:depFilter==="tout"?"white":"#737373",fontSize:11,fontWeight:600,whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>Tout</button>
        {CAT_DEP.map(c=><button key={c.id} onClick={()=>setDepFilter(c.id)} style={{padding:"5px 12px",borderRadius:20,border:"none",cursor:"pointer",background:depFilter===c.id?c.color:"#1a1a1a",color:depFilter===c.id?"white":"#737373",fontSize:11,fontWeight:600,whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>{c.label}</button>)}
      </div>
      {filtered.length===0?<div style={{textAlign:"center",color:"#2a2a2a",padding:30,fontSize:13}}>Aucune dépense</div>:filtered.map(d=>{const cat=getCatDep(d.categorie);return(<div key={d.id} style={{background:"#111",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.06)",marginBottom:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{flex:1}}><div style={{display:"flex",gap:6,marginBottom:4}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:cat.color+"18",color:cat.color,fontWeight:600}}>{cat.label}</span><span style={{fontSize:10,color:"#404040"}}>{d.date}</span></div><div style={{color:"white",fontWeight:600,fontSize:13}}>{d.libelle}</div>{d.note&&<div style={{fontSize:11,color:"#525252",marginTop:1}}>{d.note}</div>}</div><div style={{display:"flex",alignItems:"center",gap:8,marginLeft:10}}><div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:800,color:"#f87171"}}>-{d.montant.toLocaleString()}</div><div style={{fontSize:10,color:"#525252"}}>FCFA</div></div><button onClick={()=>deleteDepense(d.id)} style={{width:28,height:28,borderRadius:8,border:"none",cursor:"pointer",background:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button></div></div>);})}
    </div>);
  };

  /* ══════════════════════════════════════════
     PARAMÈTRES
  ══════════════════════════════════════════ */
  const SettingsPanel = () => {
    const [livreurPhone, setLivreurPhone] = useState(settings.livreurPhone||"");
    const [shopifyStore, setShopifyStore] = useState(settings.shopifyStore||"");
    const [shopifyToken, setShopifyToken] = useState("");
    const [oldPwd, setOldPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [pwdMsg, setPwdMsg] = useState("");
    const [saved, setSaved] = useState(false);

    async function saveCfg() {
      const updates = { livreurPhone, msgTemplate };
      if (isPatron && shopifyStore) {
        updates.shopifyStore = shopifyStore;
        if (shopifyToken) updates.shopifyToken = shopifyToken;
      }
      await saveSettings(updates);
      // Update env-like storage via settings
      if (shopifyStore) {
        await fetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({SHOPIFY_STORE:shopifyStore,...(shopifyToken?{SHOPIFY_TOKEN:shopifyToken}:{})})});
      }
      setSaved(true); setTimeout(()=>setSaved(false),2000);
    }

    async function changePwd() {
      if (!newPwd || newPwd.length<4) return setPwdMsg("Minimum 4 caractères");
      const res = await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"change",role,password:oldPwd,newPassword:newPwd})});
      const data = await res.json();
      if (data.success) { setPwdMsg("✅ Mot de passe modifié !"); setOldPwd(""); setNewPwd(""); }
      else setPwdMsg(data.error||"Erreur");
    }

    return(
      <div style={{padding:"0 0 40px"}}>
        {/* Livreur */}
        <div style={{background:"#111",borderRadius:14,padding:18,border:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"white",marginBottom:12}}>🛵 Livreur</div>
          <div style={{fontSize:11,color:"#525252",marginBottom:5}}>Numéro WhatsApp du livreur</div>
          <input value={livreurPhone} onChange={e=>setLivreurPhone(e.target.value)} placeholder="ex: 2250701234567" style={IS}/>
          <div style={{fontSize:10,color:"#404040",marginTop:5}}>Format international sans + (ex: 2250701234567)</div>
        </div>

        {/* Shopify (patron only) */}
        {isPatron&&<div style={{background:"#111",borderRadius:14,padding:18,border:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"white",marginBottom:12}}>🔗 Boutique Shopify</div>
          <div style={{fontSize:11,color:"#525252",marginBottom:5}}>Domaine boutique</div>
          <input value={shopifyStore} onChange={e=>setShopifyStore(e.target.value)} placeholder="yahni.myshopify.com" style={{...IS,marginBottom:10}}/>
          <div style={{fontSize:11,color:"#525252",marginBottom:5}}>Token API (laisser vide pour ne pas changer)</div>
          <input type="password" value={shopifyToken} onChange={e=>setShopifyToken(e.target.value)} placeholder="atkn_..." style={IS}/>
        </div>}

        {/* Message template */}
        <div style={{background:"#111",borderRadius:14,padding:18,border:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"white",marginBottom:8}}>💬 Message auto WhatsApp</div>
          <div style={{fontSize:11,color:"#525252",marginBottom:8}}>Variables: <code style={{color:"#f59e0b"}}>{"{nom}"}</code> <code style={{color:"#f59e0b"}}>{"{produit}"}</code> <code style={{color:"#f59e0b"}}>{"{prix}"}</code></div>
          <textarea value={msgTemplate} onChange={e=>setMsgTemplate(e.target.value)} style={{...IS,minHeight:120,resize:"vertical"}}/>
        </div>

        {/* Mot de passe */}
        <div style={{background:"#111",borderRadius:14,padding:18,border:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"white",marginBottom:12}}>🔐 Changer le mot de passe</div>
          <input type="password" value={oldPwd} onChange={e=>setOldPwd(e.target.value)} placeholder="Ancien mot de passe" style={{...IS,marginBottom:8}}/>
          <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Nouveau mot de passe" style={{...IS,marginBottom:10}}/>
          {pwdMsg&&<div style={{fontSize:12,color:pwdMsg.includes("✅")?"#34d399":"#f87171",marginBottom:8}}>{pwdMsg}</div>}
          <button onClick={changePwd} style={{width:"100%",padding:10,borderRadius:10,border:"none",cursor:"pointer",background:"rgba(99,102,241,0.15)",color:"#818cf8",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Changer le mot de passe</button>
        </div>

        <button onClick={saveCfg} style={{width:"100%",padding:14,borderRadius:12,border:"none",cursor:"pointer",background:saved?"#059669":"linear-gradient(135deg,#f59e0b,#ef4444)",color:"white",fontSize:14,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
          {saved?"✅ Enregistré !":"💾 Enregistrer les paramètres"}
        </button>

        {isPatron&&<button onClick={()=>{setRole(null);setScreen("login");setLoginRole(null);setShowSettings(false);}} style={{width:"100%",padding:12,borderRadius:12,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#525252",fontSize:13,cursor:"pointer",marginTop:10,fontFamily:"'DM Sans',sans-serif"}}>🚪 Déconnexion</button>}
      </div>
    );
  };

  /* ══════════════════════════════════════════
     TABS
  ══════════════════════════════════════════ */
  const tabs = isPatron
    ? [{id:"commandes",label:"📋 Commandes"},{id:"bilan",label:"📊 Bilan"},{id:"depenses",label:"📉 Dépenses"},{id:"produits",label:"📦 Produits"},{id:"reportees",label:`⏰ (${reportees.length})`}]
    : [{id:"commandes",label:"📋 Commandes"},{id:"stock",label:"📦 Stock"},{id:"reportees",label:`⏰ (${reportees.length})`}];

  const beneficeToday = livreesToday.reduce((s,o)=>s+(o.prix||0)-o.livraison,0);
  const depensesToday = depenses.filter(d=>d.date===today).reduce((s,d)=>s+d.montant,0);

  /* ══════════════════════════════════════════
     MAIN APP RENDER
  ══════════════════════════════════════════ */
  return (
    <div style={{minHeight:"100vh",background:"#080808",fontFamily:"'DM Sans',sans-serif",color:"white",paddingBottom:60}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#222}`}</style>

      {/* HEADER */}
      <div style={{background:"rgba(8,8,8,0.98)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${accent},${isPatron?"#ef4444":"#8b5cf6"})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⌚</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:"-0.3px"}}>ShopTrack Pro</div>
            <div style={{fontSize:10,color:accent}}>{isPatron?"👑 Patron — Yah-ni":"👩‍💼 Assistante — Yah-ni"}</div>
          </div>
        </div>
        {isPatron?(
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {[{v:todayOrders.length,l:"CMD",c:"#fbbf24"},{v:livreesToday.length,l:"✓",c:"#34d399"},{v:(beneficeToday-depensesToday).toLocaleString()+"F",l:"Net",c:"#818cf8"}].map(({v,l,c})=>(<div key={l} style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#404040"}}>{l}</div></div>))}
          </div>
        ):(
          <div style={{display:"flex",gap:12}}>
            {[{v:todayOrders.length,l:"Colis",c:"#ec4899"},{v:livreesToday.length,l:"Livrés",c:"#34d399"},{v:enAttenteToday.length,l:"Restants",c:"#fbbf24"}].map(({v,l,c})=>(<div key={l} style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#404040"}}>{l}</div></div>))}
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{loadShopifyOrders();}} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:refreshing?"#f59e0b":"#525252",fontSize:14,cursor:"pointer"}}>{refreshing?"⟳":"🔄"}</button>
          <button onClick={()=>setShowSettings(true)} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#525252",fontSize:14,cursor:"pointer"}}>⚙️</button>
        </div>
      </div>

      {/* Stats bar (assistante) */}
      {!isPatron&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"12px 16px",background:"#0c0c0c",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          {[{v:todayOrders.length,l:"Total",c:"#ec4899",icon:"📦"},{v:livreesToday.length,l:"Livrés",c:"#34d399",icon:"✅"},{v:enAttenteToday.length,l:"En attente",c:"#fbbf24",icon:"⏳"},{v:reportees.length,l:"Reportés",c:"#a78bfa",icon:"⏰"}].map(({v,l,c,icon})=>(
            <div key={l} style={{background:c+"0d",borderRadius:12,padding:"10px 6px",textAlign:"center",border:`1px solid ${c}1a`}}>
              <div style={{fontSize:14}}>{icon}</div>
              <div style={{fontSize:20,fontWeight:800,color:c,lineHeight:1.2}}>{v}</div>
              <div style={{fontSize:9,color:"#525252",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* NAV */}
      <div style={{display:"flex",padding:"10px 16px",gap:6,overflowX:"auto",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        {tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 15px",borderRadius:20,border:"none",cursor:"pointer",whiteSpace:"nowrap",background:tab===t.id?accent:"rgba(255,255,255,0.04)",color:tab===t.id?"#080808":"#737373",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{t.label}</button>))}
      </div>

      {/* CONTENT */}
      <div style={{padding:"16px"}}>

        {tab==="commandes"&&(
          <div>
            <button onClick={()=>setShowAddOrder(true)} style={{width:"100%",padding:"11px",borderRadius:14,border:`2px dashed ${accent}44`,background:accent+"08",color:accent,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:16,fontFamily:"'DM Sans',sans-serif"}}>✍️ Ajouter une commande manuellement</button>
            {refreshing&&orders.length===0?<Loader text="Chargement des commandes Shopify..."/>:(
              <>
                {[{titre:"Abidjan",e:"🏙️",c:"#818cf8",items:abidjanO},{titre:"Hors Abidjan",e:"🛣️",c:"#fbbf24",items:horsO},{titre:"Destination inconnue",e:"❓",c:"#525252",items:autreO}].map(({titre,e,c,items})=>(
                  <div key={titre} style={{marginBottom:24}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{width:30,height:30,borderRadius:10,background:c+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{e}</span>
                      <span style={{fontWeight:700,fontSize:14,color:"white"}}>{titre}</span>
                      <span style={{fontSize:12,color:"#404040"}}>{items.length} cmd{items.length!==1?"s":""}</span>
                    </div>
                    {items.length===0?<div style={{color:"#2a2a2a",fontSize:13,padding:"6px 0"}}>Aucune commande</div>:items.map(o=><OrderCard key={o.shopifyId} order={o}/>)}
                  </div>
                ))}
                {todayOrders.length===0&&!refreshing&&<div style={{textAlign:"center",padding:40}}><div style={{fontSize:40,marginBottom:12}}>📭</div><div style={{color:"#525252",fontSize:14}}>Aucune commande aujourd'hui</div><button onClick={loadShopifyOrders} style={{marginTop:12,padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(245,158,11,0.15)",color:"#f59e0b",fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>🔄 Actualiser</button></div>}
              </>
            )}
          </div>
        )}

        {tab==="bilan"&&isPatron&&<BilanTab/>}
        {tab==="depenses"&&isPatron&&<DepensesTab/>}
        {tab==="produits"&&isPatron&&<ProduitsTab/>}
        {tab==="stock"&&!isPatron&&<StockTab/>}
        {tab==="reportees"&&(<div><div style={{fontSize:12,color:"#404040",marginBottom:12}}>Remises automatiquement à la date choisie.</div>{reportees.length===0?<div style={{textAlign:"center",color:"#2a2a2a",padding:40}}>⏰ Aucune commande reportée</div>:reportees.map(o=><OrderCard key={o.shopifyId} order={o}/>)}</div>)}
      </div>

      {/* ══ MODALS ══ */}
      {modal?.type==="livrer"&&(<BS onClose={()=>setModal(null)} border="rgba(52,211,153,0.25)"><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:44,marginBottom:8}}>✅</div><div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Confirmer la livraison</div><div style={{color:"#737373",fontSize:13}}>{modal.order.client}</div><div style={{color:"#525252",fontSize:12,marginTop:2}}>{modal.order.produit}</div></div><div style={{display:"flex",gap:10}}><CB onClick={()=>setModal(null)}/><button onClick={()=>doLivrer(modal.order)} style={{flex:1,padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#34d399,#059669)",color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✓ Confirmer livré</button></div></BS>)}

      {modal?.type==="motif"&&(<BS onClose={()=>{setModal(null);setMotifSel("");}} border="rgba(239,68,68,0.25)"><div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Motif de non-livraison</div><div style={{color:"#737373",fontSize:12,marginBottom:14}}>{modal.order.client}</div>{MOTIFS.map(m=><button key={m} onClick={()=>setMotifSel(m)} style={{display:"block",width:"100%",padding:"11px 14px",borderRadius:10,marginBottom:7,border:`1px solid ${motifSel===m?"#818cf8":"rgba(255,255,255,0.06)"}`,background:motifSel===m?"rgba(129,140,248,0.12)":"transparent",color:motifSel===m?"white":"#737373",fontSize:13,cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif"}}>{m}</button>)}{motifSel==="Reporter à date choisie"&&<input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} style={{...IS,marginBottom:8}}/>}<div style={{display:"flex",gap:10,marginTop:8}}><CB onClick={()=>{setModal(null);setMotifSel("");}}/><button onClick={()=>doMotif(modal.order)} disabled={!motifSel} style={{flex:1,padding:12,borderRadius:10,border:"none",background:motifSel?"linear-gradient(135deg,#ef4444,#dc2626)":"#1a1a1a",color:motifSel?"white":"#525252",fontSize:13,fontWeight:700,cursor:motifSel?"pointer":"default",fontFamily:"'DM Sans',sans-serif"}}>Valider</button></div></BS>)}

      {modal?.type==="whatsapp"&&(<BS onClose={()=>setModal(null)} border="rgba(37,211,102,0.25)"><div style={{fontWeight:700,fontSize:15,marginBottom:4}}>💬 WhatsApp</div><div style={{color:"#737373",fontSize:12,marginBottom:12}}>{modal.order.client} · +{modal.order.phone}</div><textarea value={waMsg} onChange={e=>setWaMsg(e.target.value)} style={{...IS,minHeight:130,resize:"vertical",border:"1px solid rgba(37,211,102,0.2)",marginBottom:12}}/><div style={{display:"flex",gap:10}}><CB onClick={()=>setModal(null)}/><button onClick={()=>sendWA(modal.order)} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#25d366,#128c7e)",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>📲 Envoyer</button></div></BS>)}

      {/* Ajout commande manuelle */}
      {showAddOrder&&(<BS onClose={()=>setShowAddOrder(false)} border={`rgba(${isPatron?"245,158,11":"236,72,153"},0.3)`}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:3}}>✍️ Commande manuelle</div>
        <div style={{fontSize:11,color:"#525252",marginBottom:16}}>Commande reçue hors Shopify</div>
        <div style={{marginBottom:10}}><div style={{fontSize:11,color:"#525252",marginBottom:4}}>Nom du client *</div><input value={newOrder.client} onChange={e=>setNewOrder(p=>({...p,client:e.target.value}))} placeholder="Ex: Kofi Mensah" style={IS}/></div>
        <div style={{marginBottom:10}}><div style={{fontSize:11,color:"#525252",marginBottom:4}}>Téléphone *</div><input type="tel" value={newOrder.phone} onChange={e=>setNewOrder(p=>({...p,phone:e.target.value}))} placeholder="0701234567" style={IS}/></div>
        <div style={{marginBottom:12}}><div style={{fontSize:11,color:"#525252",marginBottom:6}}>Produit</div>
          {products.length>0?(<div style={{display:"flex",flexDirection:"column",gap:5}}>{products.slice(0,6).map(p=>(<button key={p.id} onClick={()=>setNewOrder(prev=>({...prev,produitId:p.id}))} style={{padding:"9px 12px",borderRadius:10,border:`1px solid ${newOrder.produitId===p.id?accent:"rgba(255,255,255,0.07)"}`,background:newOrder.produitId===p.id?accent+"15":"transparent",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",fontFamily:"'DM Sans',sans-serif"}}><span style={{color:newOrder.produitId===p.id?"white":"#737373",fontSize:12,fontWeight:newOrder.produitId===p.id?700:400}}>{p.nom}</span><span style={{fontSize:11,color:newOrder.produitId===p.id?accent:"#525252"}}>Stock: {p.stockActuel}</span></button>))}</div>)
          :<input value={newOrder.produitId} onChange={e=>setNewOrder(p=>({...p,produitId:e.target.value}))} placeholder="Nom du produit" style={IS}/>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div><div style={{fontSize:11,color:"#525252",marginBottom:4}}>Quantité</div><input type="number" min="1" value={newOrder.qte} onChange={e=>setNewOrder(p=>({...p,qte:e.target.value}))} style={IS}/></div>
          <div><div style={{fontSize:11,color:"#525252",marginBottom:4}}>Commune</div><select value={newOrder.commune} onChange={e=>setNewOrder(p=>({...p,commune:e.target.value}))} style={IS}>{COMMUNES_ABIDJAN.map(c=><option key={c} value={c}>{c}</option>)}<option value="Bouaké">Bouaké</option><option value="Daloa">Daloa</option><option value="Inconnu">Inconnue</option></select></div>
        </div>
        <div style={{marginBottom:16}}><div style={{fontSize:11,color:"#525252",marginBottom:4}}>Note (optionnel)</div><input value={newOrder.note} onChange={e=>setNewOrder(p=>({...p,note:e.target.value}))} placeholder="Ex: Livraison urgente..." style={IS}/></div>
        <div style={{display:"flex",gap:10}}><CB onClick={()=>setShowAddOrder(false)}/><button onClick={addOrderManual} disabled={!newOrder.client||!newOrder.phone} style={{flex:1,padding:13,borderRadius:12,border:"none",background:newOrder.client&&newOrder.phone?`linear-gradient(135deg,${accent},${isPatron?"#ef4444":"#8b5cf6"})`:"#1a1a1a",color:newOrder.client&&newOrder.phone?"white":"#525252",fontSize:14,fontWeight:700,cursor:newOrder.client&&newOrder.phone?"pointer":"default",fontFamily:"'DM Sans',sans-serif"}}>✓ Ajouter</button></div>
      </BS>)}

      {/* Ajout dépense */}
      {showAddDep&&(<BS onClose={()=>setShowAddDep(false)} border="rgba(239,68,68,0.3)">
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>➕ Nouvelle dépense</div>
        {[{k:"libelle",l:"Libellé *",ph:"Ex: Emballages kraft"},{k:"montant",l:"Montant (FCFA) *",ph:"30000",t:"number"},{k:"date",l:"Date",t:"date"},{k:"note",l:"Note",ph:"Détails..."}].map(({k,l,ph,t})=>(<div key={k} style={{marginBottom:10}}><div style={{fontSize:11,color:"#525252",marginBottom:4}}>{l}</div><input type={t||"text"} value={newDep[k]} onChange={e=>setNewDep(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={IS}/></div>))}
        <div style={{marginBottom:14}}><div style={{fontSize:11,color:"#525252",marginBottom:6}}>Catégorie</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CAT_DEP.map(c=><button key={c.id} onClick={()=>setNewDep(p=>({...p,categorie:c.id}))} style={{padding:"5px 10px",borderRadius:20,border:"none",cursor:"pointer",background:newDep.categorie===c.id?c.color+"33":"#1a1a1a",color:newDep.categorie===c.id?c.color:"#737373",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{c.label}</button>)}</div></div>
        <div style={{display:"flex",gap:10}}><CB onClick={()=>setShowAddDep(false)}/><button onClick={addDepense} disabled={!newDep.libelle||!newDep.montant} style={{flex:1,padding:13,borderRadius:12,border:"none",background:newDep.libelle&&newDep.montant?"linear-gradient(135deg,#ef4444,#f97316)":"#1a1a1a",color:newDep.libelle&&newDep.montant?"white":"#525252",fontSize:14,fontWeight:700,cursor:newDep.libelle&&newDep.montant?"pointer":"default",fontFamily:"'DM Sans',sans-serif"}}>✓ Enregistrer {newDep.montant?(+newDep.montant).toLocaleString()+" F":""}</button></div>
      </BS>)}

      {/* Paramètres */}
      {showSettings&&(<div style={{position:"fixed",inset:0,background:"#080808",zIndex:300,overflowY:"auto"}}>
        <div style={{padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
            <button onClick={()=>setShowSettings(false)} style={{width:36,height:36,borderRadius:10,border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#525252",fontSize:18,cursor:"pointer"}}>←</button>
            <div style={{fontWeight:800,fontSize:18,color:"white"}}>⚙️ Paramètres</div>
          </div>
          <SettingsPanel/>
        </div>
      </div>)}
    </div>
  );
}
