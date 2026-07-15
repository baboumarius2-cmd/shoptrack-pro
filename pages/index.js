import { useState, useEffect, useCallback, useRef, Component } from "react";
import { COMMUNES, MOTIFS, CAT_DEP, TODAY, getZone, badgeColor, displayCommune, catDep, fmt, Spin, Sheet, Stat } from "../lib/ui.jsx";

function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof window!=="undefined" ? window.atob(base64) : "";
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/* Activation des notifications push — utilisé en Card (Paramètres) et en bandeau (page livreur) */
function NotifSetup({role, isLivreur, banner}){
  const [on,setOn]=useState(false);
  const [checking,setChecking]=useState(true);
  const [msg,setMsg]=useState("");
  useEffect(()=>{ (async()=>{
    try{
      if(typeof Notification==="undefined"||!("serviceWorker" in navigator)){ setChecking(false); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setOn(!!sub && Notification.permission==="granted");
    }catch(e){}
    setChecking(false);
  })(); },[]);
  async function enable(){
    setMsg("");
    const r = await activerNotifs(role, isLivreur);
    setMsg(r.msg);
    if(r.ok) setOn(true);
  }
  async function disable(){
    try{
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if(sub){ await fetch("/api/push-subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"unsubscribe",endpoint:sub.endpoint})}); await sub.unsubscribe(); }
      setOn(false); setMsg("🔕 Notifications désactivées sur cet appareil.");
    }catch(e){ setMsg("❌ "+e.message); }
  }
  if(banner){
    if(checking||on) return null;
    return (
      <div className="card" style={{padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",borderLeft:"3px solid #4F46E5"}}>
        <span style={{fontSize:20}}>🔔</span>
        <div style={{flex:1,minWidth:150,fontSize:12,color:"var(--text-soft)"}}>Active les notifications pour être prévenu dès qu'une commande arrive, même app fermée.</div>
        <button onClick={enable} className="btn btn-gold" style={{padding:"9px 14px",fontSize:12}}>Activer</button>
        {msg&&<div style={{width:"100%",fontSize:11,color:msg.includes("❌")?"#C0392B":"#1E8E54",fontWeight:600}}>{msg}</div>}
      </div>
    );
  }
  return (
    <Card title="🔔 Notifications" badge={on?"Activées ✅":undefined}>
      <p style={{fontSize:12,color:"#5B6B8C",marginBottom:12,lineHeight:1.5}}>
        {isLivreur?"Sois prévenu dès qu'une commande arrive sur ta page, même quand l'app est fermée.":"Sois prévenu(e) à chaque nouvelle commande Shopify, même quand l'app est fermée. À activer sur chaque appareil qui doit recevoir les alertes."}
      </p>
      {msg&&<p style={{fontSize:12,color:msg.includes("❌")?"#C0392B":"#1E8E54",marginBottom:12,fontWeight:600}}>{msg}</p>}
      {!on
        ? <button onClick={enable} className="btn btn-gold" style={{width:"100%"}}>🔔 Activer les notifications sur cet appareil</button>
        : <button onClick={disable} className="btn btn-outline" style={{width:"100%"}}>🔕 Désactiver sur cet appareil</button>}
    </Card>
  );
}

/* Active les notifications push sur cet appareil (partagé : Paramètres, bandeau livreur, écran de bienvenue) */
async function activerNotifs(role, isLivreur){
  try{
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||typeof Notification==="undefined") return {ok:false,msg:"❌ Non supporté par ce navigateur. Utilise l'app installée (APK) ou Chrome."};
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if(!pub) return {ok:false,msg:"❌ Clé manquante : ajoute NEXT_PUBLIC_VAPID_PUBLIC_KEY dans Vercel puis redéploie."};
    const perm = await Notification.requestPermission();
    if(perm!=="granted") return {ok:false,msg:"❌ Permission refusée. Autorise les notifications pour Yah-ni dans les réglages du téléphone."};
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(pub) });
    const r = await fetch("/api/push-subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",role,notifType:isLivreur?"livraisons":"commandes",subscription:sub.toJSON()})});
    const d = await r.json();
    if(d.success) return {ok:true,msg:isLivreur?"✅ Activé ! Tu seras prévenu dès qu'une commande arrive sur ta page.":"✅ Activé ! Cet appareil sera prévenu à chaque nouvelle commande."};
    return {ok:false,msg:"❌ "+(d.error||"Erreur")};
  }catch(e){ return {ok:false,msg:"❌ "+e.message}; }
}

/* Écran de bienvenue au premier lancement : demande toutes les permissions en un clic */
function OnboardingPerms({role, isLivreur, onDone}){
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  async function toutActiver(){
    setBusy(true);
    const r = await activerNotifs(role, isLivreur);
    setMsg(r.msg);
    setBusy(false);
    if(r.ok) setTimeout(onDone, 1600);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.75)",backdropFilter:"blur(6px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .25s ease"}}>
      <div className="card scaleIn" style={{maxWidth:420,width:"100%",padding:"28px 24px",textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#6366F1,#4338CA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(79,70,229,0.4)"}}>🛍️</div>
        <h2 style={{fontSize:19,fontWeight:800,marginBottom:8}}>Bienvenue sur Yah-ni Store !</h2>
        <p style={{fontSize:13,color:"var(--text-soft,#5B6B8C)",lineHeight:1.6,marginBottom:18}}>Pour bien fonctionner, l'application a besoin de quelques autorisations sur cet appareil :</p>
        <div style={{textAlign:"left",display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,background:"var(--bg,#F8FAFC)",border:"1px solid var(--border,#E9EDF3)"}}>
            <span style={{fontSize:24}}>🔔</span>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Notifications</div>
              <div style={{fontSize:11,color:"var(--text-mute,#94A3B8)"}}>{isLivreur?"Être prévenu dès qu'une livraison arrive sur ta page, même app fermée":"Être prévenu(e) à chaque nouvelle commande, même app fermée"}</div>
            </div>
          </div>
        </div>
        {msg&&<p style={{fontSize:12,fontWeight:600,color:msg.includes("❌")?"#C0392B":"#1E8E54",marginBottom:14}}>{msg}</p>}
        <button onClick={toutActiver} disabled={busy} className="btn btn-gold" style={{width:"100%",padding:14,fontSize:15,marginBottom:10}}>{busy?"Activation...":"✅ Tout activer maintenant"}</button>
        <button onClick={onDone} style={{background:"none",border:"none",color:"var(--text-mute,#94A3B8)",fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Plus tard</button>
      </div>
    </div>
  );
}

function shadeColor(hex, percent){
  const h = (hex||"#8B5CF6").replace("#","");
  const f = parseInt(h.length===3?h.split("").map(c=>c+c).join(""):h,16);
  const t = percent<0?0:255, p = Math.abs(percent);
  const R = f>>16, G = f>>8&0x00FF, B = f&0x0000FF;
  return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}
function roleGrad(colorOrRole){
  const color = (colorOrRole && typeof colorOrRole==="object") ? (colorOrRole.color||"#8B5CF6") : (colorOrRole||"#8B5CF6");
  return `linear-gradient(135deg, ${color}, ${shadeColor(color,-0.25)})`;
}

const MODULE_DEFS = [
  {id:"commandes",icon:"📋",label:"Commandes",perm:"commandes"},
  {id:"relance",icon:"🔄",label:"Relancer",perm:"relance"},
  {id:"clients",icon:"👥",label:"Clients",perm:"clients"},
  {id:"bilan",icon:"📊",label:"Bilan",perm:"bilan"},
  {id:"depenses",icon:"📉",label:"Dépenses",perm:"depenses"},
  {id:"stock",icon:"📦",label:"Stock",perm:"stock"},
  {id:"wishlist",icon:"⭐",label:"À commander",perm:"wishlist"},
  {id:"boutiques",icon:"🏪",label:"Boutiques",perm:"boutiques"},
  {id:"reportees",icon:"⏰",label:"Reportées",perm:"reportees"},
];
function defaultTabFor(roleObj){
  if(!roleObj) return "commandes";
  if(roleObj.permissions?.livreur_mode) return "livraisons";
  if(roleObj.is_system) return "commandes";
  const found = MODULE_DEFS.find(m=>roleObj.permissions?.[m.perm]);
  return found?found.id:"commandes";
}

class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state = { error:null, info:null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ this.setState({ info }); console.error(error, info); }
  render(){
    if(this.state.error){
      return (
        <div style={{minHeight:"100vh",background:"#0F1B3C",color:"#fff",padding:24,fontFamily:"monospace",fontSize:13,whiteSpace:"pre-wrap",lineHeight:1.6}}>
          <h2 style={{fontSize:18,marginBottom:16}}>⚠️ Erreur détectée</h2>
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:14,marginBottom:14}}>{String(this.state.error && (this.state.error.stack || this.state.error.message) || this.state.error)}</div>
          {this.state.info&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:14,fontSize:11,color:"#9AA8C4"}}>{this.state.info.componentStack}</div>}
          <button onClick={()=>{try{localStorage.removeItem("yahni_role");}catch{} window.location.reload();}} style={{marginTop:20,padding:"10px 16px",borderRadius:10,border:"none",background:"#E5B567",color:"#0F1B3C",fontWeight:700,fontFamily:"inherit"}}>🔄 Réinitialiser et recharger</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  function lsGet(k){ try{ return localStorage.getItem(k); }catch{ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch{} }
  function lsRemove(k){ try{ localStorage.removeItem(k); }catch{} }
  // Session : le code PIN est redemandé à chaque nouvelle ouverture de l'app
  function ssGet(k){ try{ return sessionStorage.getItem(k); }catch{ return null; } }
  function ssSet(k,v){ try{ sessionStorage.setItem(k,v); }catch{} }
  function ssRemove(k){ try{ sessionStorage.removeItem(k); }catch{} }
  const [screen, setScreen] = useState("login");
  const [loginRole, setLoginRole] = useState(null);
  const [role, setRole] = useState(null);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [sPwd, setSPwd] = useState("");
  const [sPwd2, setSPwd2] = useState("");
  const [sErr, setSErr] = useState("");
  const [auth, setAuth] = useState(false);

  const [tab, setTab] = useState("commandes");
  const [orders, setOrders] = useState([]);
  const [clientHisto, setClientHisto] = useState({});
  const [livreurs, setLivreurs] = useState([]);
  const [livreurFilter, setLivreurFilter] = useState("tous");
  const [callFilter, setCallFilter] = useState("toutes");
  const [produits, setProduits] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [boutiques, setBoutiques] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null);
  const [motifSel, setMotifSel] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [notif, setNotif] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [bilanMode, setBilanMode] = useState("jour");
  const [bilanDate, setBilanDate] = useState(TODAY);
  const [viewDate, setViewDate] = useState(TODAY);
  const [depFilter, setDepFilter] = useState("tout");
  const [theme, setTheme] = useState("clair");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [showAddProd, setShowAddProd] = useState(false);
  const [showShopifyPicker, setShowShopifyPicker] = useState(false);
  const [linkTargetId, setLinkTargetId] = useState(null);
  const [newProd, setNewProd] = useState({nom:"",emoji:"📦",categorie:"",stockInitial:"",coutAchat:"",coutFret:"",prixVente:"",conditionnement:"",seuilAlerte:"10",image:"",shopifyId:"",shopifyNom:""});
  const [showAddDep, setShowAddDep] = useState(false);
  const [newDep, setNewDep] = useState({libelle:"",montant:"",categorie:"emballage",date:TODAY,note:""});
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({client:"",phone:"",produit:"",qte:"1",commune:"Cocody",note:""});
  const [showAddWish, setShowAddWish] = useState(false);
  const [newWish, setNewWish] = useState({nom:"",image:"",lien:"",prixEstime:"",source:"",note:""});
  const [showAddBoutique, setShowAddBoutique] = useState(false);
  const [newBoutique, setNewBoutique] = useState({nom:"",domaine:"",token:"",couleur:"#E5B567"});

  const [msgTemplate, setMsgTemplate] = useState("Bonjour {nom} 👋\n\nMerci pour votre commande sur Yah-ni Store ! 🛍️\n\n📦 {produit}\n💰 {prix} FCFA\n\nVotre commande sera livrée aujourd'hui. Restez disponible svp.\n\nMerci de votre confiance ! 🙏");

  const [ROLES, setROLES] = useState({});
  const [rolesLoaded, setRolesLoaded] = useState(false);
  useEffect(()=>{
    fetch("/api/roles").then(r=>r.json()).then(list=>{
      const map = {}; (list||[]).forEach(r0=>{ map[r0.slug]=r0; }); setROLES(map); setRolesLoaded(true);
    }).catch(()=>setRolesLoaded(true));
  },[]);

  const currentRoleObj = ROLES[role] || null;
  const perms = currentRoleObj?.permissions || {};
  const isPatron = currentRoleObj?.is_system === true;
  const isLivreur = !!perms.livreur_mode;
  function can(mod){ return isPatron || !!perms[mod]; }

  useEffect(()=>{
    const saved = ssGet("yahni_role");
    if(saved){ setRole(saved); setScreen("app"); }
    ssRemove("yahni_role"); // nettoyage de l'ancienne connexion permanente
  },[]);

  // Garde-fou : si le rôle a été supprimé, ou si l'onglet actuel n'est plus autorisé, on corrige
  useEffect(()=>{
    if(screen!=="app" || !rolesLoaded) return;
    if(!currentRoleObj){ logout(); return; }
    const allowed = isLivreur ? ["livraisons","mes_depenses"].includes(tab) : (MODULE_DEFS.some(m=>m.id===tab && can(m.perm)) || (tab==="livraisons_histo" && can("commandes")));
    if(!allowed) setTab(defaultTabFor(currentRoleObj));
  },[screen, rolesLoaded, role, currentRoleObj]);

  // Service worker des notifications (silencieux, ne bloque rien)
  useEffect(()=>{
    if(typeof navigator!=="undefined" && "serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }
  },[]);

  // Écran de bienvenue au premier lancement : propose d'activer les permissions (notifications)
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardMsg, setOnboardMsg] = useState("");
  useEffect(()=>{
    if(screen!=="app" || !rolesLoaded || !currentRoleObj) return;
    if(lsGet("yahni_onboard_"+role)) return;
    if(typeof Notification==="undefined" || !("serviceWorker" in navigator)){ lsSet("yahni_onboard_"+role,"1"); return; }
    if(Notification.permission==="granted"){ lsSet("yahni_onboard_"+role,"1"); return; }
    setShowOnboard(true);
  },[screen, rolesLoaded, role, currentRoleObj]);
  async function onboardActiver(){
    setOnboardMsg("⏳ Activation...");
    const r = await activerNotifs(role, isLivreur);
    setOnboardMsg(r.msg);
    if(r.ok){ lsSet("yahni_onboard_"+role,"1"); setTimeout(()=>setShowOnboard(false), 1500); }
  }
  function onboardPlusTard(){
    lsSet("yahni_onboard_"+role,"1");
    setShowOnboard(false);
  }

  // Alerte in-app de secours : nouvelles commandes (Patron/Assistante) ou nouvelles livraisons (Livreur)
  const seenIdsRef = useRef(null);
  useEffect(()=>{
    if(screen!=="app") return;
    const principal = livreurs.find(l=>l.principal);
    const relevant = isLivreur
      ? orders.filter(o=>o.transferred && o.date===TODAY && (!o.livreurId || String(o.livreurId)===String(principal?.id||"")))
      : orders.filter(o=>o.date===TODAY && !o.isManual);
    const ids = new Set(relevant.map(o=>o.shopifyId));
    if(seenIdsRef.current===null){ if(relevant.length>0 || !refreshing) seenIdsRef.current=ids; return; }
    const news = [...ids].filter(id=>!seenIdsRef.current.has(id));
    if(news.length>0){
      const label = isLivreur ? `🛵 ${news.length===1?"Nouvelle livraison reçue !":news.length+" nouvelles livraisons reçues !"}` : `🛒 ${news.length===1?"Nouvelle commande reçue !":news.length+" nouvelles commandes reçues !"}`;
      toast(label);
      if(typeof Notification!=="undefined" && Notification.permission==="granted"){
        try{ new Notification("Yah-ni Store", { body: label, icon:"/icons/icon-192.png", tag:"inapp-new" }); }catch(e){}
      }
    }
    seenIdsRef.current = ids;
  },[orders, screen, isLivreur, livreurs]);

  function logout(){
    ssRemove("yahni_role");
    setRole(null); setScreen("login"); setLoginRole(null);
  }

  function toast(msg, type="success"){ setNotif({msg,type}); setTimeout(()=>setNotif(null),3000); }

  /* ─ AUTH ─ */
  async function doLogin(){
    if(pwd.length<4)return;
    setAuth(true); setErr("");
    try{
      const r = await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",role:loginRole,password:pwd})});
      const d = await r.json();
      if(d.success){ ssSet("yahni_role",loginRole); setRole(loginRole); setScreen("app"); setPwd(""); setTab(defaultTabFor(ROLES[loginRole])); }
      else if(d.error==="no_password") { setScreen("setup"); setPwd(""); }
      else { setErr(d.error||"Code incorrect"); setPwd(""); }
    }catch{ setErr("Erreur de connexion. Vérifiez votre internet."); setPwd(""); }
    setAuth(false);
  }
  async function doSetup(){
    if(sPwd.length<4)return;
    if(sPwd!==sPwd2){ setSErr("Les codes ne correspondent pas, recommencez"); setSPwd(""); setSPwd2(""); return; }
    setAuth(true);
    try{
      const r = await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"setup",role:loginRole,newPassword:sPwd})});
      const d = await r.json();
      if(d.success){ ssSet("yahni_role",loginRole); setRole(loginRole); setScreen("app"); setSPwd(""); setSPwd2(""); setTab(defaultTabFor(ROLES[loginRole])); }
      else { setSErr(d.error); setSPwd(""); setSPwd2(""); }
    }catch{ setSErr("Erreur. Réessayez."); }
    setAuth(false);
  }
  useEffect(()=>{ if(screen==="login"&&loginRole&&pwd.length===4&&!auth) doLogin(); },[pwd]);
  useEffect(()=>{ if(screen==="setup"&&sPwd.length===4&&sPwd2.length===4&&!auth) doSetup(); },[sPwd,sPwd2]);

  /* ─ DATA ─ */
  const loadOrders = useCallback(async(forDate)=>{
    setRefreshing(true);
    try{
      const d = forDate || TODAY;
      const [shopR, savedR] = await Promise.all([ fetch(`/api/shopify?date=${d}&days=7`), fetch("/api/orders") ]);
      const shop = await shopR.json();
      const saved = await savedR.json();
      // Protection : si Shopify n'a rien renvoyé du tout (erreur), on garde la liste actuelle au lieu de l'écraser
      if(!shop.orders){ setRefreshing(false); return; }
      const savedMap = {};
      (saved||[]).forEach(o=>{ savedMap[o.shopify_id]=o; });
      // Historique par client (téléphone) : permet d'afficher "2ᵉ commande" et le sort de la précédente
      const histo = {};
      (saved||[]).forEach(o=>{
        const p=(o.phone||"").replace(/\D/g,""); if(!p) return;
        if(!histo[p]) histo[p]=[];
        histo[p].push({id:o.shopify_id, statut:o.statut||"en_attente", date:o.date||"", produit:o.produit||""});
      });
      setClientHisto(histo);
      const fromSaved = (o, statutForce) => ({
        id:o.numero||o.shopify_id, shopifyId:o.shopify_id, numero:o.numero, client:o.client, phone:o.phone||"",
        produit:o.produit, produitId:o.produit_id||"", quantite:o.quantite||1, prix:o.prix||0,
        commune:o.commune||"Inconnu", adresse:o.adresse||o.commune, livraison:2000,
        statut:statutForce||o.statut||"en_attente", date:o.date, heure:o.heure||"", contacted:o.contacted||[],
        transferred:o.transferred||false, livreurStatut:o.livreur_statut||"en_attente",
        note:o.note||"", motif:o.motif||"", reportDate:o.report_date||"", wasReported:o.was_reported||false, isManual:!!o.is_manual,
        boutiqueNom:o.boutique_nom||"", boutiqueId:o.boutique_id||"",
        statutPar:o.statut_par||"", statutHeure:o.statut_heure||"",
        livreurId:o.livreur_id||"", livreurNom:o.livreur_nom||"", transfertHeure:o.transfert_heure||"", transfertDate:o.transfert_date||"", livreurPrincipal:(o.livreur_principal===true||o.livreur_principal===false)?o.livreur_principal:null, appelHeure:o.appel_heure||"", appelPar:o.appel_par||"",
      });
      const merged = shop.orders.map(o=>{
        const s = savedMap[o.shopifyId];
        return s ? {...o, statut:s.statut||"en_attente", motif:s.motif||"", reportDate:s.report_date||"", contacted:s.contacted||[], transferred:s.transferred||false, livreurStatut:s.livreur_statut||"en_attente", wasReported:s.was_reported||false, statutPar:s.statut_par||"", statutHeure:s.statut_heure||"", livreurId:s.livreur_id||"", livreurNom:s.livreur_nom||"", transfertHeure:s.transfert_heure||"", transfertDate:s.transfert_date||"", livreurPrincipal:(s.livreur_principal===true||s.livreur_principal===false)?s.livreur_principal:null, appelHeure:s.appel_heure||"", appelPar:s.appel_par||""} : o;
      });
      const mergedIds = new Set(merged.map(m=>m.shopifyId));
      const manuals = (saved||[]).filter(o=>o.is_manual).map(o=>fromSaved(o));
      // Commandes reportées (Shopify) sauvegardées : les ré-injecter même si Shopify ne les renvoie pas pour cette date
      const reportedSaved = (saved||[]).filter(o=>!o.is_manual && o.statut==="reportee" && !mergedIds.has(o.shopify_id)).map(o=>fromSaved(o,"reportee"));
      // Filet de sécurité anti-disparition : les commandes Shopify du jour demandé déjà
      // enregistrées en base (statut, contact...) mais absentes de la réponse Shopify
      // (erreur partielle d'une boutique, limite API...) sont conservées à l'écran
      const d7 = (()=>{ const t=new Date(d+"T12:00:00"); t.setDate(t.getDate()-6); return t.toISOString().split("T")[0]; })();
      const rescuedSaved = (saved||[]).filter(o=>!o.is_manual && o.statut!=="reportee" && o.date>=d7 && o.date<=d && !mergedIds.has(o.shopify_id)).map(o=>fromSaved(o));
      setOrders([...merged, ...manuals, ...reportedSaved, ...rescuedSaved]);
    }catch(e){ console.error(e); }
    setRefreshing(false);
  },[]);

  const loadAll = useCallback(async()=>{
    setLoading(true);
    try{
      const [s,p,d,w,b,cl,lv] = await Promise.all([ fetch("/api/settings"), fetch("/api/produits"), fetch("/api/depenses"), fetch("/api/wishlist"), fetch("/api/boutiques"), fetch("/api/clients"), fetch("/api/livreurs") ]);
      const sj = await s.json(); setSettings(sj||{});
      if(sj?.msg_template) setMsgTemplate(sj.msg_template);
      if(sj?.theme) setTheme(sj.theme);
      setProduits(await p.json()||[]);
      setDepenses(await d.json()||[]);
      setWishlist(await w.json()||[]);
      setBoutiques(await b.json()||[]);
      setClients(await cl.json()||[]);
      const lvj = await lv.json(); setLivreurs(Array.isArray(lvj)?lvj:[]);
    }catch(e){ console.error(e); }
    setLoading(false);
  },[]);

  useEffect(()=>{ if(screen==="app"){ loadAll(); loadOrders(viewDate); } },[screen]);
  useEffect(()=>{ if(screen==="app"){ loadOrders(viewDate); } },[viewDate]);

  // Rafraîchissement automatique des commandes en arrière-plan (toutes les 60s)
  useEffect(()=>{
    if(screen!=="app") return;
    const id = setInterval(()=>{ loadOrders(viewDate); },60000);
    return ()=>clearInterval(id);
  },[screen,viewDate,loadOrders]);

  /* ─ DERIVED ─ */
  // Orders to show today: created today OR reported to today
  const todayOrders = orders.filter(o => o.date===viewDate || (o.statut==="reportee" && o.reportDate===viewDate));
  const abidjan = todayOrders.filter(o=>getZone(o.commune)==="abidjan");
  const hors = todayOrders.filter(o=>getZone(o.commune)==="hors");
  const autre = todayOrders.filter(o=>getZone(o.commune)==="autre");
  const reportees = orders.filter(o=>o.statut==="reportee" && o.reportDate!==viewDate);
  const livrees = todayOrders.filter(o=>o.statut==="livree");
  const enAttente = todayOrders.filter(o=>o.statut==="en_attente");
  // Livreur sees transferred orders
  const livreurPrincipal = livreurs.find(l=>l.principal);
  // Livraisons du livreur principal : commandes transférées à lui, pour la date consultée.
  // Une commande avec un livreur nommé différent du principal est TOUJOURS exclue,
  // même si l'identifiant n'a pas pu être enregistré (double sécurité).
  const estAuPrincipal = (o)=>{
    // Flag enregistré au moment du transfert : fiable même si la liste des livreurs n'est pas chargée
    if(o.livreurPrincipal===true) return true;
    if(o.livreurPrincipal===false) return false;
    // Anciennes commandes (avant cette mise à jour) :
    if(o.livreurId) return String(o.livreurId)===String(livreurPrincipal?.id||"");
    if(o.livreurNom && livreurPrincipal && o.livreurNom!==livreurPrincipal.nom) return false;
    return true;
  };
  // Une commande apparaît chez le livreur à la date où on la lui a ENVOYÉE (pas la date de la commande)
  const livraisons = orders.filter(o=>o.transferred && (o.transfertDate||o.date)===viewDate && estAuPrincipal(o));
  // Historique de tous les transferts (tous livreurs) pour l'onglet Livraisons
  const transferts = orders.filter(o=>o.transferred && (o.transfertDate||o.date)===viewDate);

  /* ─ ORDER ACTIONS ─ */
  async function updateOrder(o, updates){
    setOrders(prev=>prev.map(x=>x.shopifyId===o.shopifyId?{...x,...updates}:x));
    const body = { shopify_id:o.shopifyId, numero:o.numero||o.id, client:o.client, phone:o.phone, produit:o.produit,
      produit_id:o.produitId||"", quantite:o.quantite||1, prix:o.prix||0, commune:o.commune, adresse:o.adresse||o.commune,
      date:o.date, heure:o.heure, is_manual:o.isManual||false, boutique_nom:o.boutiqueNom||"", boutique_id:o.boutiqueId||"",
      statut:updates.statut!==undefined?updates.statut:o.statut,
      motif:updates.motif!==undefined?updates.motif:o.motif,
      report_date:updates.reportDate!==undefined?(updates.reportDate||null):(o.reportDate||null),
      contacted:updates.contacted!==undefined?updates.contacted:o.contacted,
      transferred:updates.transferred!==undefined?updates.transferred:o.transferred,
      livreur_statut:updates.livreurStatut!==undefined?updates.livreurStatut:o.livreurStatut,
      was_reported:updates.wasReported!==undefined?updates.wasReported:o.wasReported,
      statut_par:updates.statutPar!==undefined?updates.statutPar:(o.statutPar||null),
      statut_heure:updates.statutHeure!==undefined?updates.statutHeure:(o.statutHeure||null),
      appel_heure:updates.appelHeure!==undefined?updates.appelHeure:(o.appelHeure||null),
      appel_par:updates.appelPar!==undefined?updates.appelPar:(o.appelPar||null),
      livreur_id:updates.livreurId!==undefined?updates.livreurId:(o.livreurId||null),
      livreur_nom:updates.livreurNom!==undefined?updates.livreurNom:(o.livreurNom||null),
      transfert_heure:updates.transfertHeure!==undefined?updates.transfertHeure:(o.transfertHeure||null),
      transfert_date:updates.transfertDate!==undefined?updates.transfertDate:(o.transfertDate||null),
      livreur_principal:updates.livreurPrincipal!==undefined?updates.livreurPrincipal:(o.livreurPrincipal===true||o.livreurPrincipal===false?o.livreurPrincipal:null),
    };
    // Enregistrement avec nouvelle tentative automatique : aucun transfert ne doit se perdre
    let ok=false;
    for(let tent=0;tent<3 && !ok;tent++){
      try{
        if(tent>0) await new Promise(r=>setTimeout(r,1500));
        const r = await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update",shopifyId:o.shopifyId,updates:body})});
        const d = await r.json();
        ok = !!d.success;
        if(!ok && d.error && tent===2) toast("⚠️ Enregistrement échoué : "+d.error,"error");
      }catch(e){
        if(tent===2) toast("⚠️ Pas de réseau : l'action n'a pas été enregistrée. Réessaie.","error");
      }
    }
  }

  async function syncClient(o){
    // Trouver la catégorie du produit
    let categorie = "";
    if(o.produitId){ const p=produits.find(x=>x.shopify_id===o.produitId); if(p) categorie=p.categorie||""; }
    if(!categorie && o.produit){ const p=produits.find(x=>o.produit.includes(x.nom)); if(p) categorie=p.categorie||""; }
    await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sync",client:{
      nom:o.client, phone:o.phone, produit:o.produit, categorie, commune:o.commune, prix:o.prix, date:o.date, boutiqueNom:o.boutiqueNom
    }})});
  }

  function nowHM(){ return new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); }
  async function doLivrer(o){
    await updateOrder(o,{statut:"livree",livreurStatut:"livre",statutPar:currentRoleObj?.label||role,statutHeure:nowHM()});
    // decrement stock
    if(o.produitId){
      const prod = produits.find(p=>p.shopify_id===o.produitId);
      if(prod){ await fetch("/api/produits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"decrement",id:prod.id,qte:o.quantite||1})}); }
    }
    await syncClient(o); // ajouter/mettre à jour le client dans la base
    loadAll();
    setModal(null); toast(`✅ ${o.client} — Livré`);
  }
  function doMotif(o){
    const isRep = motifSel==="Reporter à une date";
    updateOrder(o,{ statut:isRep?"reportee":"non_livree", motif:motifSel, statutPar:currentRoleObj?.label||role, statutHeure:nowHM(), ...(isRep&&reportDate?{reportDate,wasReported:true}:{}) });
    setModal(null); setMotifSel(""); setReportDate("");
    toast(isRep?`⏰ Reporté au ${reportDate}`:"✗ Motif enregistré", isRep?"info":"error");
  }
  function openWA(o){
    setWaMsg(msgTemplate.replace("{nom}",o.client).replace("{produit}",o.produit).replace("{prix}",fmt(o.prix)));
    setModal({type:"wa",order:o});
  }
  function sendWA(o){
    const p = o.phone.replace(/\D/g,"");
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(waMsg)}`,"_blank");
    const c=[...(o.contacted||[])]; if(!c.includes("whatsapp"))c.push("whatsapp");
    updateOrder(o,{contacted:c}); setModal(null); toast("💬 WhatsApp ouvert");
  }
  function callCli(o){
    window.open(`tel:+${o.phone.replace(/\D/g,"")}`,"_blank");
    const c=[...(o.contacted||[])];
    if(!c.includes("appel")){
      c.push("appel");
      updateOrder(o,{contacted:c, appelHeure:nowHM(), appelPar:currentRoleObj?.label||role});
    }
  }
  function smsCli(o){
    const p = o.phone.replace(/\D/g,"");
    const msg = msgTemplate.replace("{nom}",o.client).replace("{produit}",o.produit).replace("{prix}",fmt(o.prix));
    window.open(`sms:+${p}?body=${encodeURIComponent(msg)}`,"_blank");
    const c=[...(o.contacted||[])]; if(!c.includes("sms"))c.push("sms"); updateOrder(o,{contacted:c});
    toast("✉️ SMS ouvert");
  }
  function transfer(o){
    // Étape 1 : choix du livreur, puis étape 2 : choix du canal
    setModal({type:"transfer", order:o, livreur:null});
  }
  function doTransfer(o, livreur, canal){
    const lp = (livreur?.phone||"").replace(/\D/g,"");
    updateOrder(o,{transferred:true, livreurId:String(livreur?.id||""), livreurNom:livreur?.nom||"", transfertHeure:nowHM(), transfertDate:TODAY, livreurPrincipal:!!livreur?.principal});
    const msg=`🛵 Nouvelle livraison Yah-ni\n\n👤 ${o.client}\n📞 ${o.phone}\n📍 ${o.adresse||o.commune}\n📦 ${o.produit}\n💰 À encaisser : ${fmt(o.prix)} F${o.boutiqueNom?`\n🏪 ${o.boutiqueNom}`:""}\n\nMerci ✅`;
    if(canal!=="app"){
      if(lp){
        if(canal==="sms") window.open(`sms:+${lp}?body=${encodeURIComponent(msg)}`,"_blank");
        else window.open(`https://wa.me/${lp}?text=${encodeURIComponent(msg)}`,"_blank");
      } else {
        toast("⚠️ Ce livreur n'a pas de numéro enregistré (Paramètres → Livreurs)","error");
      }
    }
    setModal(null);
    toast(canal==="app"?`📲 Envoyé sur la page de ${livreur?.nom||"livreur"}`:`📤 Envoyé à ${livreur?.nom||"livreur"} par ${canal==="sms"?"SMS":"WhatsApp"}`);
  }
  function livreurUpdate(o, statut){
    const map={en_route:"en_attente",arrive:"en_attente",livre:"livree"};
    updateOrder(o,{livreurStatut:statut, ...(statut==="livre"?{statut:"livree",statutPar:currentRoleObj?.label||role,statutHeure:nowHM()}:{})});
    // "En route" → ouvre un SMS pré-rempli pour prévenir le client (le livreur peut ajuster l'heure avant d'envoyer)
    if(statut==="en_route"){
      const p=(o.phone||"").replace(/\D/g,"");
      if(p){
        const msgClient=`Bonjour ${o.client}, votre livreur Yah-ni Store est en route pour vous livrer votre colis (${o.produit}). Montant à prévoir : ${fmt(o.prix)} F. Arrivée estimée : dans 30 à 45 min. Merci !`;
        window.open(`sms:+${p}?body=${encodeURIComponent(msgClient)}`,"_blank");
      }
    }
    toast(statut==="livre"?"✅ Marqué livré":statut==="en_route"?"🚗 En route — SMS client prêt à envoyer":"📍 Arrivé");
  }

  function doPasLivre(o, motif){
    const isReport = motif && motif.toLowerCase().includes("reporter");
    updateOrder(o,{ statut:isReport?"reportee":"non_livree", livreurStatut:"en_attente", motif, statutPar:currentRoleObj?.label||role, statutHeure:nowHM() });
    toast("✗ Enregistré : "+motif);
  }

  async function addOrderManual(){
    if(!newOrder.client||!newOrder.phone)return;
    const id="MANUAL-"+Date.now();
    const prod = produits.find(p=>p.nom===newOrder.produit);
    const order={ id:"#M"+Date.now().toString().slice(-4), shopifyId:id, numero:"#M"+Date.now().toString().slice(-4),
      client:newOrder.client, phone:newOrder.phone.replace(/\D/g,""), produit:newOrder.produit||"Produit",
      produitId:prod?.shopify_id||"", quantite:+newOrder.qte||1, prix:(prod?.prix_vente||0)*(+newOrder.qte||1),
      commune:newOrder.commune, adresse:newOrder.commune, livraison:2000, statut:"en_attente", date:TODAY,
      heure:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}), contacted:[], transferred:false,
      livreurStatut:"en_attente", note:newOrder.note, motif:"", reportDate:"", wasReported:false, isManual:true,
      ...(isLivreur?{transferred:true, transfertDate:TODAY, transfertHeure:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}), livreurPrincipal:true, livreurNom:(livreurs.find(l=>l.principal)?.nom)||"", livreurId:String(livreurs.find(l=>l.principal)?.id||"")}:{}) };
    setOrders(p=>[order,...p]);
    await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add_manual",order:{
      shopify_id:id, numero:order.numero, client:order.client, phone:order.phone, produit:order.produit, produit_id:order.produitId,
      quantite:order.quantite, prix:order.prix, commune:order.commune, adresse:order.commune, statut:"en_attente",
      date:TODAY, heure:order.heure, contacted:[], transferred:order.transferred||false, livreur_statut:"en_attente", note:order.note, is_manual:true,
      ...(order.transferred?{transfert_date:order.transfertDate, transfert_heure:order.transfertHeure, livreur_principal:true, livreur_nom:order.livreurNom||null, livreur_id:order.livreurId||null}:{}) }})});
    setNewOrder({client:"",phone:"",produit:"",qte:"1",commune:"Cocody",note:""}); setShowAddOrder(false); toast("✍️ Commande ajoutée");
  }

  async function addProduit(){
    if(!newProd.nom||!newProd.stockInitial)return;
    await fetch("/api/produits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",produit:newProd})});
    setNewProd({nom:"",emoji:"📦",categorie:"",stockInitial:"",coutAchat:"",coutFret:"",prixVente:"",conditionnement:"",seuilAlerte:"10",image:"",shopifyId:"",shopifyNom:""});
    setShowAddProd(false); loadAll(); toast("📦 Produit ajouté");
  }
  async function delProduit(id){ await fetch("/api/produits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",id})}); setProduits(p=>p.filter(x=>x.id!==id)); }
  async function relierProduitShopify(sp){
    if(linkTargetId){
      await fetch("/api/produits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update",id:linkTargetId,updates:{shopify_id:sp.shopifyId}})});
      loadAll(); toast("🔗 Produit lié à "+sp.nom);
    } else {
      setNewProd(p=>({...p,shopifyId:sp.shopifyId,shopifyNom:sp.nom,nom:p.nom||sp.nom,prixVente:p.prixVente||String(sp.prixVente||""),image:p.image||sp.image||"",stockInitial:p.stockInitial||String(sp.stock||""),conditionnement:p.conditionnement||sp.conditionnement||""}));
    }
    setShowShopifyPicker(false); setLinkTargetId(null);
  }

  async function addDepense(){
    if(!newDep.libelle||!newDep.montant)return;
    await fetch("/api/depenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",depense:{...newDep,montant:+newDep.montant,auteur:currentRoleObj?.label||role}})});
    setNewDep({libelle:"",montant:"",categorie:"emballage",date:TODAY,note:""}); setShowAddDep(false); loadAll(); toast("📉 Dépense enregistrée");
  }
  async function delDepense(id){ await fetch("/api/depenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",depense:{id}})}); setDepenses(p=>p.filter(d=>d.id!==id)); }

  async function addWish(){
    if(!newWish.nom)return;
    await fetch("/api/wishlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",item:newWish})});
    setNewWish({nom:"",image:"",lien:"",prixEstime:"",source:"",note:""}); setShowAddWish(false); loadAll(); toast("⭐ Ajouté à la wishlist");
  }
  async function delWish(id){ await fetch("/api/wishlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",item:{id}})}); setWishlist(p=>p.filter(w=>w.id!==id)); }

  async function addBoutique(){
    if(!newBoutique.nom||!newBoutique.domaine||!newBoutique.token)return;
    const r = await fetch("/api/boutiques",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",boutique:newBoutique})});
    const d = await r.json();
    if(d.error){ toast("❌ "+d.error,"error"); return; }
    setNewBoutique({nom:"",domaine:"",token:"",couleur:"#E5B567"}); setShowAddBoutique(false); loadAll(); loadOrders(); toast("🏪 Boutique ajoutée");
  }
  async function delBoutique(id){ await fetch("/api/boutiques",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",id})}); setBoutiques(p=>p.filter(b=>b.id!==id)); loadOrders(); toast("Boutique supprimée"); }
  async function toggleBoutique(id,active){ await fetch("/api/boutiques",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"toggle",id,active})}); setBoutiques(p=>p.map(b=>b.id===id?{...b,active}:b)); loadOrders(); }
  async function delClient(id){ await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",id})}); setClients(p=>p.filter(c=>c.id!==id)); toast("Client supprimé"); }


  async function saveSettings(updates){
    setSettings(p=>({...p,...updates}));
    await fetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(updates)});
    toast("✅ Paramètres enregistrés");
  }

  /* ═══ LOGIN SCREENS ═══ */
  if(!rolesLoaded) return <div style={{minHeight:"100vh",background:"#0F1B3C",display:"flex",alignItems:"center",justifyContent:"center"}}><Spin size={32} c="#E5B567"/></div>;
  if(screen==="login" && !loginRole) return <LoginHome ROLES={ROLES} onPick={setLoginRole}/>;
  if(screen==="login" && loginRole) return <LoginPwd ROLES={ROLES} role={loginRole} pwd={pwd} setPwd={setPwd} err={err} setErr={setErr} auth={auth} onBack={()=>{setLoginRole(null);setPwd("");setErr("");}} onLogin={doLogin}/>;
  if(screen==="setup") return <SetupPwd ROLES={ROLES} role={loginRole} sPwd={sPwd} setSPwd={setSPwd} sPwd2={sPwd2} setSPwd2={setSPwd2} sErr={sErr} setSErr={setSErr} auth={auth} onSetup={doSetup}/>;
  if(screen==="app" && !currentRoleObj) return <div style={{minHeight:"100vh",background:"#0F1B3C",display:"flex",alignItems:"center",justifyContent:"center"}}><Spin size={32} c="#E5B567"/></div>;

  /* ═══ NAV ═══ */
  const navItems = isLivreur
    ? [{id:"livraisons",icon:"🛵",label:"Mes livraisons"},{id:"mes_depenses",icon:"📉",label:"Mes dépenses"}]
    : [...MODULE_DEFS.filter(m=>can(m.perm)), ...(can("commandes")?[{id:"livraisons_histo",icon:"🛵",label:"Livraisons"}]:[])];

  const beneficeJour = livrees.reduce((s,o)=>s+(o.prix||0)-o.livraison,0);
  const depJour = depenses.filter(d=>d.date===TODAY).reduce((s,d)=>s+d.montant,0);

  return (
    <div className={`app-root theme-${theme}`} style={{minHeight:"100vh",display:"flex"}}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',sans-serif}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:#CBD5E8;border-radius:5px}

/* THÈME CLAIR (défaut) */
.theme-clair{--bg:#F8FAFC;--card:#FFFFFF;--text:#0F172A;--text-soft:#475569;--text-mute:#94A3B8;--border:#E9EDF3;--input-bg:#FFFFFF;--topbar-bg:rgba(248,250,252,0.72);--sidebar-bg:#0F172A;--brand:#4F46E5;--brand-bright:#6366F1;}
/* THÈME SOMBRE */
.theme-sombre{--bg:#0F172A;--card:#1E293B;--text:#F1F5F9;--text-soft:#94A3B8;--text-mute:#64748B;--border:#293548;--input-bg:#243349;--topbar-bg:rgba(15,23,42,0.72);--sidebar-bg:#0B1220;--brand:#6366F1;--brand-bright:#818CF8;}

.app-root{background:var(--bg);color:var(--text);}
.app-root .card{background:var(--card)!important;border-color:var(--border)!important;}
.app-root .topbar{background:var(--topbar-bg)!important;border-color:var(--border)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
.app-root .input{background:var(--input-bg)!important;color:var(--text)!important;border-color:var(--border)!important;}

/* En mode sombre, adoucir les textes très foncés codés en dur */
.theme-sombre .order-card .order-client{color:var(--text)!important;}
.theme-sombre h1,.theme-sombre h2,.theme-sombre h3{color:var(--text);}
.theme-sombre .stat-card>div{color:var(--text);}

/* Toggle thème animé */
.theme-toggle{position:relative;overflow:hidden;transition:background .3s ease,border-color .3s ease;}
.theme-toggle:hover{transform:translateY(-1px);}
.theme-toggle .ic{display:inline-block;animation:popIn .35s ease;}

/* Barre de navigation mobile (cachée sur ordinateur) */
.mobile-nav{display:none;}
.mobile-topbar-btn{display:none;}

@media (max-width:768px){
  /* Cacher la sidebar desktop, afficher la nav du bas */
  .desktop-sidebar{display:none!important;}
  .main-content{margin-left:0!important;padding-bottom:78px!important;}
  .content-pad{padding:14px!important;}
  .mobile-nav{display:flex!important;}
  .mobile-topbar-btn{display:flex!important;}

  /* Textes plus gros sur mobile */
  .app-root{font-size:16px;}
  .stat-value{font-size:26px!important;}
  .stat-label{font-size:12px!important;}
  .order-client{font-size:17px!important;}
  .order-produit{font-size:14px!important;}
  .btn{font-size:15px!important;padding:13px 18px!important;}
  .order-action-btn{padding:13px!important;font-size:15px!important;}
  .topbar-title{font-size:19px!important;}

  /* Cartes plus aérées */
  .order-card{padding:18px!important;margin-bottom:14px!important;}
  .stat-card{padding:18px!important;}
}

/* Barre nav du bas */
.mobile-nav{position:fixed;bottom:0;left:0;right:0;height:66px;background:var(--topbar-bg);border-top:1px solid var(--border);z-index:90;align-items:center;justify-content:space-around;padding:0 4px;box-shadow:0 -2px 16px rgba(15,27,60,0.08);}
.mobile-nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;font-family:inherit;padding:6px 8px;border-radius:12px;flex:1;max-width:80px;}
.mobile-nav-item .ic{font-size:21px;}
.mobile-nav-item .lb{font-size:10px;font-weight:600;}
      `}</style>

      {notif&&<div style={{position:"fixed",top:20,right:20,zIndex:1000,background:notif.type==="error"?"#FDEAEA":notif.type==="info"?"#E8F1FE":"#E3F7EE",border:`1px solid ${notif.type==="error"?"#F5C2C2":notif.type==="info"?"#BcDcFc":"#A8E6C9"}`,borderRadius:12,padding:"12px 16px",boxShadow:"0 8px 24px rgba(15,27,60,0.14)",fontSize:13,fontWeight:600,color:notif.type==="error"?"#C0392B":notif.type==="info"?"#2563EB":"#1E8E54",animation:"scaleIn .2s ease",maxWidth:320}}>{notif.msg}</div>}

      {/* SIDEBAR (desktop) — hidden for livreur */}
      {!isLivreur && <div className="desktop-sidebar"><Sidebar ROLES={ROLES} role={role} navItems={navItems} tab={tab} setTab={setTab} reportees={reportees} todayOrders={todayOrders} livrees={livrees} enAttente={enAttente} beneficeJour={beneficeJour} depJour={depJour} canVoirMontants={can('voir_montants')} theme={theme} onSettings={()=>setShowSettings(true)} onLogout={logout}/></div>}

      <div className="main-content" style={{marginLeft:isLivreur?0:240,flex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        {/* TOPBAR */}
        <div className="topbar" style={{borderBottom:"1px solid #E8ECF4",padding:"0 16px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:roleGrad(ROLES[role]),display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}} className="mobile-topbar-btn">{ROLES[role].icon}</div>
            <div>
              <h1 className="topbar-title" style={{fontSize:17,fontWeight:700}}>{navItems.find(n=>n.id===tab)?.icon} {navItems.find(n=>n.id===tab)?.label}</h1>
              <p style={{fontSize:11,color:"var(--text-mute)"}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setTheme(t=>{const nt=t==="clair"?"sombre":"clair"; saveSettings({theme:nt}); return nt;})} className="theme-toggle" style={{width:38,height:38,borderRadius:10,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}><span className="ic" key={theme}>{theme==="clair"?"🌙":"☀️"}</span></button>
            <button onClick={()=>{loadOrders(viewDate);toast("🔄 Actualisé");}} style={{width:38,height:38,borderRadius:10,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:refreshing?"#E5B567":"var(--text-soft)"}}>{refreshing?<Spin size={16}/>:"🔄"}</button>
            {isLivreur&&<button onClick={logout} style={{padding:"8px 14px",borderRadius:10,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",fontSize:13,color:"var(--text-soft)",fontWeight:600}}>🚪</button>}
            {can('commandes')&&tab==="commandes"&&<button onClick={()=>setShowAddOrder(true)} className="btn btn-gold" style={{padding:"9px 16px"}}>✍️ Ajouter</button>}
          </div>
        </div>

        <div className="content-pad" style={{flex:1,padding:20,maxWidth:1240,margin:"0 auto",width:"100%"}}>
          {/* ═══ COMMANDES ═══ */}
          {tab==="commandes" && can('commandes') && (
            <div className="fadeIn">
              <DateNav viewDate={viewDate} setViewDate={setViewDate}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
                <Stat label="Total du jour" value={todayOrders.length} icon="📦" color="#E5B567"/>
                <Stat label="Livrées" value={livrees.length} icon="✅" color="#2BB673" sub={`${todayOrders.length?Math.round(livrees.length/todayOrders.length*100):0}%`}/>
                <Stat label="En attente" value={enAttente.length} icon="⏳" color="#F2922C"/>
                {isPatron&&<Stat label="Net du jour" value={fmt(beneficeJour-depJour)+" F"} icon="💰" color="#8B5CF6"/>}
              </div>
              {(()=>{
                const appelees = todayOrders.filter(o=>(o.contacted||[]).includes("appel"));
                const nonAppelees = todayOrders.filter(o=>!(o.contacted||[]).includes("appel") && o.statut!=="livree");
                const cf = isPatron ? callFilter : "toutes";
                const applyCall = (list)=> cf==="appelees"?list.filter(o=>(o.contacted||[]).includes("appel")):cf==="non_appelees"?list.filter(o=>!(o.contacted||[]).includes("appel") && o.statut!=="livree"):list;
                return <>
              {isPatron&&<>
              <div style={{display:"flex",gap:10,marginBottom:8}}>
                <div onClick={()=>setCallFilter(callFilter==="appelees"?"toutes":"appelees")} style={{flex:1,borderRadius:18,padding:"16px 14px",cursor:"pointer",position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0FA97A,#0B8A63)",color:"#fff",border:callFilter==="appelees"?"2px solid #0F172A":"2px solid transparent",boxShadow:callFilter==="appelees"?"0 6px 18px rgba(15,23,42,.18)":"none",transition:"all .15s"}}>
                  <div style={{position:"absolute",right:10,top:10,fontSize:20,opacity:.35}}>📞</div>
                  <div style={{fontSize:32,fontWeight:800,lineHeight:1}}>{appelees.length}</div>
                  <div style={{fontSize:12,fontWeight:700,marginTop:6}}>Appelées</div>
                  <div style={{fontSize:10,opacity:.75,marginTop:2}}>Voir la liste + heures</div>
                </div>
                <div onClick={()=>setCallFilter(callFilter==="non_appelees"?"toutes":"non_appelees")} style={{flex:1,borderRadius:18,padding:"16px 14px",cursor:"pointer",position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#E5484D,#C23438)",color:"#fff",border:callFilter==="non_appelees"?"2px solid #0F172A":"2px solid transparent",boxShadow:callFilter==="non_appelees"?"0 6px 18px rgba(15,23,42,.18)":"none",transition:"all .15s"}}>
                  <div style={{position:"absolute",right:10,top:10,fontSize:20,opacity:.35}}>🚫</div>
                  <div style={{fontSize:32,fontWeight:800,lineHeight:1}}>{nonAppelees.length}</div>
                  <div style={{fontSize:12,fontWeight:700,marginTop:6}}>Pas appelées</div>
                  <div style={{fontSize:10,opacity:.75,marginTop:2}}>Qui reste à appeler</div>
                </div>
              </div>
              <button onClick={()=>setCallFilter("toutes")} style={{width:"100%",padding:10,borderRadius:14,border:"none",cursor:"pointer",background:callFilter==="toutes"?"#0F172A":"var(--card,#fff)",color:callFilter==="toutes"?"#fff":"var(--text-soft,#475569)",fontSize:13,fontWeight:700,marginBottom:18,fontFamily:"inherit",boxShadow:"0 1px 3px rgba(15,23,42,.06)"}}>Voir toutes les commandes ({todayOrders.length})</button>
              </>}
              {refreshing&&orders.length===0?<OrderSkeleton/>:(
                <div>
                  {(()=>{
                    const liste = applyCall(todayOrders).slice().sort((a,b)=>(b.heure||"").localeCompare(a.heure||""));
                    if(liste.length===0) return <div style={{textAlign:"center",padding:"30px",color:"#CBD5E8",fontSize:14}}>Aucune commande</div>;
                    return liste.map((o,i)=><OrderCard key={o.shopifyId} o={o} i={i} isPatron={isPatron} seePrix={can("voir_montants")} hist={clientHisto[(o.phone||"").replace(/\D/g,"")]} onLivrer={()=>setModal({type:"livrer",order:o})} onMotif={()=>setModal({type:"motif",order:o})} onWA={()=>openWA(o)} onCall={()=>callCli(o)} onSMS={()=>smsCli(o)} onTransfer={()=>transfer(o)} viewDate={viewDate} callFilter={callFilter}/>);
                  })()}
                </div>
              )}
              {!refreshing&&todayOrders.length===0&&<Empty icon="📭" title="Aucune commande aujourd'hui" sub="Les commandes Shopify apparaîtront ici"/>}

              {/* ── FLUX DES JOURS PRÉCÉDENTS (façon Shopify : on défile vers le passé) ── */}
              {cf==="toutes"&&[1,2,3,4,5,6].map(k=>{
                const dt = new Date(viewDate+"T12:00:00"); dt.setDate(dt.getDate()-k);
                const dStr = dt.toISOString().split("T")[0];
                const list = orders.filter(o=>o.date===dStr || (o.statut==="reportee"&&o.reportDate===dStr)).sort((a,b)=>(b.heure||"").localeCompare(a.heure||""));
                if(list.length===0) return null;
                const label = k===1?"Hier":k===2?"Avant-hier":"";
                const dateFr = dt.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
                return (
                  <div key={dStr} style={{marginTop:28}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"12px 16px",background:"var(--card)",border:"1px solid var(--border,#E9EDF3)",borderRadius:12,position:"sticky",top:60,zIndex:5}}>
                      <span style={{fontSize:20}}>📅</span>
                      <div>
                        <div style={{fontSize:16,fontWeight:800,color:"var(--text)"}}>{label||dateFr.charAt(0).toUpperCase()+dateFr.slice(1)}</div>
                        {label&&<div style={{fontSize:12,color:"var(--text-mute,#94A3B8)"}}>{dateFr}</div>}
                      </div>
                      <span style={{marginLeft:"auto",background:"#4F46E5",color:"#fff",borderRadius:20,padding:"3px 11px",fontSize:12,fontWeight:700}}>{list.length}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
                      {list.map((o,i)=><OrderCard key={o.shopifyId} o={o} i={i} isPatron={isPatron} seePrix={can("voir_montants")} hist={clientHisto[(o.phone||"").replace(/\D/g,"")]} onLivrer={()=>setModal({type:"livrer",order:o})} onMotif={()=>setModal({type:"motif",order:o})} onWA={()=>openWA(o)} onCall={()=>callCli(o)} onSMS={()=>smsCli(o)} onTransfer={()=>transfer(o)} viewDate={viewDate} callFilter={callFilter}/>)}
                    </div>
                  </div>
                );
              })}
              </>;})()}
            </div>
          )}
          {tab==="livraisons" && isLivreur && (
            <div className="fadeIn">
              <NotifSetup role={role} isLivreur banner/>
              <DateNav viewDate={viewDate} setViewDate={setViewDate}/>
              <button onClick={()=>setShowAddOrder(true)} style={{width:"100%",padding:13,borderRadius:14,border:"2px dashed #C7D2FE",background:"#EEF0FE",color:"#4F46E5",fontSize:14,fontWeight:700,cursor:"pointer",margin:"14px 0 0",fontFamily:"inherit"}}>➕ Ajouter une commande</button>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:22,marginTop:16}}>
                <Stat label="À livrer" value={livraisons.filter(o=>o.livreurStatut!=="livre").length} icon="📦" color="#F59E0B"/>
                <Stat label="Livrées" value={livraisons.filter(o=>o.livreurStatut==="livre").length} icon="✅" color="#10B981"/>
                <Stat label="Total" value={livraisons.length} icon="🛵" color="#3B82F6"/>
              </div>
              {livraisons.length===0?<Empty icon="🛵" title={viewDate===TODAY?"Aucune livraison aujourd'hui":"Aucune livraison ce jour-là"} sub="Les commandes transférées apparaîtront ici. Navigue avec le calendrier pour revoir tes anciennes livraisons."/>:
                livraisons.map((o,i)=><LivreurCard key={o.shopifyId} o={o} i={i} onUpdate={livreurUpdate} onCall={callCli} onPasLivre={doPasLivre}/>)}
            </div>
          )}

          {/* ═══ MES DÉPENSES (livreur) ═══ */}
          {tab==="mes_depenses" && isLivreur && (
            <div className="fadeIn">
              <button onClick={()=>setShowAddDep(true)} style={{width:"100%",padding:16,borderRadius:14,border:"2px dashed #C7D2FE",background:"#EEF0FE",color:"#4F46E5",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>➕ Ajouter une dépense</button>
              {(()=>{
                const mines = depenses.filter(d=>d.auteur===(currentRoleObj?.label||role));
                return mines.length===0?<Empty icon="📉" title="Aucune dépense" sub="Ajoute tes dépenses (carburant, réparations...) avec le bouton ci-dessus"/>:
                  mines.map(d=>{const c=catDep(d.categorie);return(
                    <div key={d.id} className="card fadeIn" style={{padding:"14px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:c.color+"18",color:c.color,fontWeight:600}}>{c.icon} {c.label}</span>
                          <span style={{fontSize:11,color:"#9AA8C4"}}>{d.date}</span>
                        </div>
                        <div style={{fontWeight:600,fontSize:14}}>{d.libelle}</div>
                        {d.note&&<div style={{fontSize:12,color:"#9AA8C4",marginTop:2}}>{d.note}</div>}
                      </div>
                      <div style={{fontSize:16,fontWeight:800,color:"#E5484D"}}>-{fmt(d.montant)} F</div>
                    </div>
                  );});
              })()}
            </div>
          )}

          {/* ═══ HISTORIQUE LIVRAISONS (Patron + Assistante) ═══ */}
          {tab==="livraisons_histo" && !isLivreur && can('commandes') && (
            <div className="fadeIn">
              <DateNav viewDate={viewDate} setViewDate={setViewDate}/>
              <div style={{display:"flex",gap:8,margin:"16px 0",flexWrap:"wrap"}}>
                <button onClick={()=>setLivreurFilter("tous")} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",background:livreurFilter==="tous"?"#4F46E5":"var(--card)",color:livreurFilter==="tous"?"#fff":"#5B6B8C",fontSize:12,fontWeight:600,fontFamily:"inherit",border:"1px solid var(--border,#E8ECF4)"}}>Tous les livreurs</button>
                {livreurs.map(lv=>(
                  <button key={lv.id} onClick={()=>setLivreurFilter(String(lv.id))} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",background:livreurFilter===String(lv.id)?"#4F46E5":"var(--card)",color:livreurFilter===String(lv.id)?"#fff":"#5B6B8C",fontSize:12,fontWeight:600,fontFamily:"inherit",border:"1px solid var(--border,#E8ECF4)"}}>🛵 {lv.nom}</button>
                ))}
              </div>
              {(()=>{
                const list = transferts.filter(o=>livreurFilter==="tous"||String(o.livreurId||livreurPrincipal?.id||"")===livreurFilter);
                const livr = list.filter(o=>o.statut==="livree").length;
                const prob = list.filter(o=>o.statut==="non_livree").length;
                return <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}}>
                    <Stat label="Envoyées" value={list.length} icon="📤" color="#4F46E5"/>
                    <Stat label="Livrées" value={livr} icon="✅" color="#10B981"/>
                    <Stat label="Problèmes" value={prob} icon="⚠️" color="#EF4444"/>
                  </div>
                  {list.length===0?<Empty icon="📤" title="Aucun transfert ce jour-là" sub="Les commandes envoyées aux livreurs apparaîtront ici"/>:
                    list.map((o,i)=>(
                      <div key={o.shopifyId} className="card fadeIn" style={{padding:"13px 16px",marginBottom:10,borderLeft:`3px solid ${o.statut==="livree"?"#10B981":o.statut==="non_livree"?"#EF4444":"#F59E0B"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <div style={{flex:1,minWidth:150}}>
                            <div style={{fontWeight:700,fontSize:14}}>{o.client}</div>
                            <div style={{fontSize:12,color:"#5B6B8C"}}>📦 {o.produit} · 📍 {displayCommune(o.commune)}{can("voir_montants")?` · ${fmt(o.prix)} F`:""}</div>
                            <div style={{fontSize:11,color:"#B45309",marginTop:2,fontWeight:600}}>🛵 {o.livreurNom||livreurPrincipal?.nom||"Livreur"}{o.transfertHeure?` · envoyée à ${o.transfertHeure}`:""}</div>
                          </div>
                          <div>
                            {o.statut==="livree"&&<span style={{fontSize:11,padding:"4px 10px",borderRadius:20,background:"#10B981",color:"#fff",fontWeight:700}}>✓ Livrée{o.statutHeure?` ${o.statutHeure}`:""}</span>}
                            {o.statut==="non_livree"&&<span style={{fontSize:11,padding:"4px 10px",borderRadius:20,background:"#FDEAEA",color:"#C0392B",fontWeight:700}}>⚠️ {o.motif||"Problème"}</span>}
                            {o.statut!=="livree"&&o.statut!=="non_livree"&&<span style={{fontSize:11,padding:"4px 10px",borderRadius:20,background:"var(--orange-bg,#FEF3E2)",color:"#B45309",fontWeight:700}}>🕐 En cours</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                </>;
              })()}
            </div>
          )}

          {/* ═══ BILAN ═══ */}
          {tab==="bilan" && can('bilan') && <Bilan orders={orders} depenses={depenses} produits={produits} mode={bilanMode} setMode={setBilanMode} date={bilanDate} setDate={setBilanDate} setTab={setTab}/>}

          {/* ═══ DÉPENSES ═══ */}
          {tab==="depenses" && can('depenses') && <DepensesTab depenses={depenses} filter={depFilter} setFilter={setDepFilter} onAdd={()=>setShowAddDep(true)} onDel={delDepense}/>}

          {/* ═══ STOCK ═══ */}
          {tab==="stock" && can('stock') && <StockTab produits={produits} canGerer={can('stock')} canVoirMontants={can('voir_montants')} loading={loading} onAdd={()=>setShowAddProd(true)} onDel={delProduit} onLink={(id)=>{setLinkTargetId(id);setShowShopifyPicker(true);}}/>}

          {/* ═══ WISHLIST ═══ */}
          {tab==="wishlist" && can('wishlist') && <WishlistTab items={wishlist} onAdd={()=>setShowAddWish(true)} onDel={delWish}/>}

          {tab==="boutiques" && can('boutiques') && <BoutiquesTab boutiques={boutiques} onAdd={()=>setShowAddBoutique(true)} onDel={delBoutique} onToggle={toggleBoutique}/>}

          {tab==="relance" && can('relance') && <RelanceTab orders={orders} settings={settings} toast={toast}/>}

          {tab==="clients" && can('clients') && <ClientsTab clients={clients} settings={settings} toast={toast} onDel={delClient}/>}

          {/* ═══ REPORTÉES ═══ */}
          {tab==="reportees" && can('reportees') && (
            <div className="fadeIn">
              <div style={{background:"#FBF4E6",border:"1px solid #F0DFB8",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#8A6D2F"}}>⏰ Ces commandes réapparaissent automatiquement le jour choisi</div>
              {reportees.length===0?<Empty icon="⏰" title="Aucune commande reportée"/>:reportees.map((o,i)=><OrderCard key={o.shopifyId} o={o} i={i} isPatron={isPatron} seePrix={can("voir_montants")} hist={clientHisto[(o.phone||"").replace(/\D/g,"")]} onLivrer={()=>setModal({type:"livrer",order:o})} onMotif={()=>setModal({type:"motif",order:o})} onWA={()=>openWA(o)} onCall={()=>callCli(o)} onSMS={()=>smsCli(o)} onTransfer={()=>transfer(o)} viewDate={viewDate} callFilter={callFilter}/>)}
            </div>
          )}
        </div>
      </div>

      {/* BARRE NAVIGATION MOBILE */}
      <div className="mobile-nav">
        {navItems.slice(0,4).map(it=>(
          <button key={it.id} onClick={()=>setTab(it.id)} className="mobile-nav-item" style={{background:tab===it.id?"rgba(99,102,241,0.16)":"none",color:tab===it.id?"var(--brand)":"var(--text-mute)"}}>
            <span className="ic">{it.icon}</span><span className="lb">{it.label}</span>
          </button>
        ))}
        {!isLivreur&&<button onClick={()=>setMobileMenu(true)} className="mobile-nav-item" style={{color:"var(--text-mute)"}}>
          <span className="ic">☰</span><span className="lb">Plus</span>
        </button>}
      </div>

      {/* MENU "PLUS" MOBILE */}
      {mobileMenu&&<div className="sheet-overlay" onClick={()=>setMobileMenu(false)}>
        <div className="sheet" onClick={e=>e.stopPropagation()} style={{background:"var(--card)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <h3 style={{fontSize:17,fontWeight:700,color:"var(--text)"}}>Menu</h3>
            <button onClick={()=>setMobileMenu(false)} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",fontSize:15,color:"var(--text-soft)"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {navItems.map(it=>(
              <button key={it.id} onClick={()=>{setTab(it.id);setMobileMenu(false);}} style={{padding:"18px 8px",borderRadius:14,border:`1.5px solid ${tab===it.id?"#E5B567":"var(--border)"}`,background:tab===it.id?"rgba(229,181,103,0.12)":"var(--card)",color:tab===it.id?"#E5B567":"var(--text-soft)",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <span style={{fontSize:24}}>{it.icon}</span><span style={{fontSize:12,fontWeight:600}}>{it.label}</span>
              </button>
            ))}
            <button onClick={()=>{setShowSettings(true);setMobileMenu(false);}} style={{padding:"18px 8px",borderRadius:14,border:"1.5px solid var(--border)",background:"var(--card)",color:"var(--text-soft)",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <span style={{fontSize:24}}>⚙️</span><span style={{fontSize:12,fontWeight:600}}>Paramètres</span>
            </button>
            <button onClick={logout} style={{padding:"18px 8px",borderRadius:14,border:"1.5px solid var(--border)",background:"var(--card)",color:"#E5484D",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <span style={{fontSize:24}}>🚪</span><span style={{fontSize:12,fontWeight:600}}>Quitter</span>
            </button>
          </div>
        </div>
      </div>}

      {/* ═══ MODALS ═══ */}
      {modal?.type==="livrer"&&<Sheet onClose={()=>setModal(null)} title="Confirmer la livraison">
        <div style={{textAlign:"center",padding:"8px 0 20px"}}>
          <div style={{width:64,height:64,borderRadius:18,background:"#E3F7EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 12px"}}>✅</div>
          <p style={{fontWeight:700,fontSize:16}}>{modal.order.client}</p>
          <p style={{color:"#5B6B8C",fontSize:13,marginTop:2}}>{modal.order.produit}</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setModal(null)} className="btn btn-outline" style={{flex:1}}>Annuler</button>
          <button onClick={()=>doLivrer(modal.order)} className="btn btn-gold" style={{flex:2}}>✓ Confirmer livré</button>
        </div>
      </Sheet>}

      {modal?.type==="motif"&&<Sheet onClose={()=>{setModal(null);setMotifSel("");}} title="Motif de non-livraison">
        <p style={{color:"#5B6B8C",fontSize:13,marginBottom:14}}>{modal.order.client}</p>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
          {MOTIFS.map(m=><button key={m} onClick={()=>setMotifSel(m)} style={{padding:"11px 14px",borderRadius:10,border:`1.5px solid ${motifSel===m?"#E5B567":"#E8ECF4"}`,background:motifSel===m?"#FBF4E6":"#fff",color:motifSel===m?"#8A6D2F":"#5B6B8C",fontSize:13,cursor:"pointer",textAlign:"left",fontWeight:motifSel===m?600:400}}>{m}</button>)}
        </div>
        {motifSel==="Reporter à une date"&&<div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,color:"#5B6B8C",marginBottom:5}}>Nouvelle date</label><input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} className="input"/></div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setModal(null);setMotifSel("");}} className="btn btn-outline" style={{flex:1}}>Annuler</button>
          <button onClick={()=>doMotif(modal.order)} disabled={!motifSel||(motifSel==="Reporter à une date"&&!reportDate)} className="btn" style={{flex:2,background:motifSel?"linear-gradient(135deg,#E5484D,#C0392B)":"#E8ECF4",color:motifSel?"#fff":"#9AA8C4"}}>Valider</button>
        </div>
      </Sheet>}

      {modal?.type==="wa"&&<Sheet onClose={()=>setModal(null)} title="Message WhatsApp">
        <p style={{color:"#5B6B8C",fontSize:13,marginBottom:12}}>{modal.order.client} · {modal.order.phone}</p>
        <textarea value={waMsg} onChange={e=>setWaMsg(e.target.value)} className="input" style={{minHeight:150,resize:"vertical",marginBottom:14}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setModal(null)} className="btn btn-outline" style={{flex:1}}>Annuler</button>
          <button onClick={()=>sendWA(modal.order)} className="btn" style={{flex:2,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff"}}>📲 Envoyer</button>
        </div>
      </Sheet>}

      {modal?.type==="transfer"&&<Sheet onClose={()=>setModal(null)} title="📤 Transférer au livreur">
        <div style={{textAlign:"center",padding:"4px 0 14px"}}>
          <p style={{fontWeight:600,fontSize:15}}>{modal.order.client}</p>
          <p style={{color:"#5B6B8C",fontSize:13,marginTop:2}}>📍 {displayCommune(modal.order.commune)} · {modal.order.adresse||""}</p>
        </div>
        {!modal.livreur ? <>
          <p style={{fontSize:13,color:"#5B6B8C",marginBottom:12,textAlign:"center"}}>1/2 — Choisis le livreur :</p>
          {livreurs.length===0&&<p style={{fontSize:12,color:"#E5484D",textAlign:"center",marginBottom:10}}>⚠️ Aucun livreur enregistré. Ajoute-les dans Paramètres → Livreurs.</p>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {livreurs.map(lv=>(
              <button key={lv.id} onClick={()=>setModal(m=>({...m,livreur:lv}))} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,border:"1px solid var(--border,#E9EDF3)",background:"var(--card,#fff)",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                <span style={{fontSize:22}}>🛵</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{lv.nom}</div>
                  <div style={{fontSize:12,color:"#9AA8C4"}}>{lv.ville}{lv.principal?" · 📲 a l'application":""}</div>
                </div>
                <span style={{color:"#9AA8C4"}}>→</span>
              </button>
            ))}
          </div>
        </> : <>
          <p style={{fontSize:13,color:"#5B6B8C",marginBottom:12,textAlign:"center"}}>2/2 — Envoyer à <b>{modal.livreur.nom}</b> par :</p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>doTransfer(modal.order,modal.livreur,"sms")} className="btn" style={{flex:1,padding:"14px",background:"#E8F1FE",color:"#2563EB",flexDirection:"column",gap:4,height:"auto"}}>
              <span style={{fontSize:24}}>📱</span> <span>Par SMS</span>
            </button>
            <button onClick={()=>doTransfer(modal.order,modal.livreur,"whatsapp")} className="btn" style={{flex:1,padding:"14px",background:"#E3F7EE",color:"#1E8E54",flexDirection:"column",gap:4,height:"auto"}}>
              <span style={{fontSize:24}}>💬</span> <span>Par WhatsApp</span>
            </button>
          </div>
          {modal.livreur.principal&&<button onClick={()=>doTransfer(modal.order,modal.livreur,"app")} className="btn" style={{width:"100%",marginTop:10,padding:"13px",background:"#F3E8FF",color:"#7C3AED"}}>📲 Sur sa page seulement (sans message)</button>}
          <p style={{fontSize:11,color:"#9AA8C4",textAlign:"center",marginTop:8}}>{modal.livreur.principal?"La commande apparaîtra aussi sur sa page dans l'app.":"Ce livreur n'a pas l'application : il reçoit uniquement le message."}</p>
          <button onClick={()=>setModal(m=>({...m,livreur:null}))} className="btn btn-outline" style={{width:"100%",marginTop:10}}>← Changer de livreur</button>
        </>}
        <button onClick={()=>setModal(null)} className="btn btn-outline" style={{width:"100%",marginTop:10}}>Annuler</button>
      </Sheet>}

      {showAddOrder&&<AddOrderSheet newOrder={newOrder} setNewOrder={setNewOrder} produits={produits} onClose={()=>setShowAddOrder(false)} onAdd={addOrderManual}/>}
      {showAddProd&&<AddProdSheet newProd={newProd} setNewProd={setNewProd} onClose={()=>setShowAddProd(false)} onAdd={addProduit} onLinkShopify={()=>{setLinkTargetId(null);setShowShopifyPicker(true);}}/>}
      {showShopifyPicker&&<ShopifyProductPicker onClose={()=>{setShowShopifyPicker(false);setLinkTargetId(null);}} onSelect={relierProduitShopify}/>}
      {showAddDep&&<AddDepSheet newDep={newDep} setNewDep={setNewDep} onClose={()=>setShowAddDep(false)} onAdd={addDepense}/>}
      {showAddWish&&<AddWishSheet newWish={newWish} setNewWish={setNewWish} onClose={()=>setShowAddWish(false)} onAdd={addWish}/>}
      {showAddBoutique&&<AddBoutiqueSheet newBoutique={newBoutique} setNewBoutique={setNewBoutique} onClose={()=>setShowAddBoutique(false)} onAdd={addBoutique}/>}
      {showOnboard&&<div style={{position:"fixed",inset:0,background:"linear-gradient(150deg,#0F172A 0%,#1E293B 55%,#0F172A 100%)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .3s ease"}}>
        <div style={{maxWidth:400,width:"100%",textAlign:"center"}}>
          <div style={{width:84,height:84,borderRadius:22,background:"linear-gradient(135deg,#6366F1,#4338CA)",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,boxShadow:"0 0 50px rgba(79,70,229,0.45)"}}>🔔</div>
          <h1 style={{color:"#fff",fontSize:24,fontWeight:800,marginBottom:10}}>Bienvenue {currentRoleObj?.icon} {currentRoleObj?.label} !</h1>
          <p style={{color:"#94A3B8",fontSize:14,lineHeight:1.6,marginBottom:8}}>
            {isLivreur
              ? "Pour ne rater aucune livraison, active les notifications : ton téléphone sonnera dès qu'une commande arrive sur ta page, même app fermée."
              : "Pour ne rater aucune commande, active les notifications : cet appareil sera prévenu à chaque nouvelle commande Shopify, même app fermée."}
          </p>
          <p style={{color:"#64748B",fontSize:12,marginBottom:24}}>Ton téléphone va te demander la permission — appuie sur « Autoriser ».</p>
          {onboardMsg&&<p style={{fontSize:13,color:onboardMsg.includes("❌")?"#F09595":"#5DCAA5",fontWeight:600,marginBottom:16}}>{onboardMsg}</p>}
          <button onClick={onboardActiver} className="btn btn-gold" style={{width:"100%",padding:16,fontSize:16,marginBottom:12}}>🔔 Tout activer</button>
          <button onClick={onboardPlusTard} style={{background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Plus tard</button>
          <p style={{color:"#475569",fontSize:11,marginTop:20}}>Tu pourras toujours activer/désactiver plus tard {isLivreur?"depuis le bandeau sur ta page":"dans Paramètres → Notifications"}.</p>
        </div>
      </div>}

      {showSettings&&<SettingsPanel settings={settings} msgTemplate={msgTemplate} setMsgTemplate={setMsgTemplate} onSave={saveSettings} onClose={()=>setShowSettings(false)} role={role} isPatron={isPatron} ROLES={ROLES} reloadRoles={()=>fetch("/api/roles").then(r=>r.json()).then(list=>{const map={};(list||[]).forEach(r0=>{map[r0.slug]=r0;});setROLES(map);})} onResetDone={()=>{loadAll();loadOrders(viewDate);}} livreurs={livreurs} reloadLivreurs={()=>fetch("/api/livreurs").then(r=>r.json()).then(l=>setLivreurs(Array.isArray(l)?l:[]))}/>}
    </div>
  );
}

export default function App(){
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

/* ════════ LOGIN COMPONENTS ════════ */
function PinPad({value,onChange,length=4,color}){
  function press(d){ if(value.length>=length) onChange(d); else onChange(value+d); }
  function back(){ onChange(value.slice(0,-1)); }
  return (
    <div>
      <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:26}}>
        {Array.from({length}).map((_,i)=>(
          <div key={i} style={{width:16,height:16,borderRadius:"50%",background:i<value.length?(color||"#E5B567"):"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.2)",transition:"background .15s"}}/>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:280,margin:"0 auto"}}>
        {["1","2","3","4","5","6","7","8","9"].map(d=>(
          <button key={d} onClick={()=>press(d)} style={{padding:"18px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#fff",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>
        ))}
        <div/>
        <button onClick={()=>press("0")} style={{padding:"18px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#fff",fontSize:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>0</button>
        <button onClick={back} style={{padding:"18px 0",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#FF8A8A",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⌫</button>
      </div>
    </div>
  );
}

function LoginHome({ROLES,onPick}){
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#0F172A 0%,#1E293B 55%,#0F172A 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      <div style={{maxWidth:440,width:"100%",animation:"fadeIn .5s ease"}}>
        <div style={{textAlign:"center",marginBottom:44}}>
          <div style={{width:84,height:84,borderRadius:24,background:"linear-gradient(135deg,#6366F1,#4338CA)",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,boxShadow:"0 0 50px rgba(79,70,229,0.45)",animation:"float 3s ease-in-out infinite"}}>🛍️</div>
          <h1 style={{fontSize:34,fontWeight:800,color:"#fff",letterSpacing:"-1px"}}>Yah-ni Store</h1>
          <p style={{color:"#9AA8C4",fontSize:14,marginTop:4}}>Gestion intelligente · yahni.store</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {Object.entries(ROLES).filter(([,r])=>r.actif!==false).sort((a,b)=>(a[1].ordre||99)-(b[1].ordre||99)).map(([k,r])=>{
            const sub = r.is_system ? "Accès complet" : r.permissions?.livreur_mode ? "Mes livraisons" : (MODULE_DEFS.filter(m=>r.permissions?.[m.perm]).map(m=>m.label).slice(0,3).join(", ") || "Accès personnalisé");
            return (
            <button key={k} onClick={()=>onPick(k)} style={{padding:"20px 22px",borderRadius:18,border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",background:"rgba(255,255,255,0.05)",color:"#fff",display:"flex",alignItems:"center",gap:16,textAlign:"left",position:"relative",overflow:"hidden",transition:"all .2s",backdropFilter:"blur(10px)"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateX(4px)";e.currentTarget.style.borderColor="rgba(229,181,103,0.4)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateX(0)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>
              <div style={{position:"absolute",inset:0,background:roleGrad(r),opacity:0.1}}/>
              <div style={{width:50,height:50,borderRadius:14,background:roleGrad(r),display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0,zIndex:1}}>{r.icon}</div>
              <div style={{zIndex:1}}>
                <div style={{fontSize:17,fontWeight:700}}>{r.label}</div>
                <div style={{fontSize:12,color:"#9AA8C4",marginTop:2}}>{sub}</div>
              </div>
              <div style={{marginLeft:"auto",color:"#9AA8C4",fontSize:20,zIndex:1}}>→</div>
            </button>
            );
          })}
        </div>
        <p style={{textAlign:"center",color:"#4A5878",fontSize:12,marginTop:32}}>© 2026 Yah-ni Store</p>
      </div>
    </div>
  );
}

function LoginPwd({ROLES,role,pwd,setPwd,err,setErr,auth,onBack,onLogin}){
  const r = ROLES[role] || {icon:"👤",label:role,color:"#8B5CF6"};
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#0F172A,#1E293B)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{maxWidth:370,width:"100%",animation:"fadeIn .4s ease"}}>
        <button onClick={onBack} style={{color:"#9AA8C4",background:"none",border:"none",cursor:"pointer",fontSize:13,marginBottom:28,fontFamily:"inherit"}}>← Retour</button>
        <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",borderRadius:22,padding:32,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{textAlign:"center",marginBottom:26}}>
            <div style={{width:56,height:56,borderRadius:16,background:roleGrad(r),display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>{r.icon}</div>
            <h2 style={{fontSize:21,fontWeight:700,color:"#fff"}}>Espace {r.label}</h2>
            <p style={{color:"#9AA8C4",fontSize:13,marginTop:3}}>{auth?"Vérification...":"Entrez votre code à 4 chiffres"}</p>
          </div>
          {err&&<p style={{color:"#FF8A8A",fontSize:12,textAlign:"center",marginBottom:14}}>{err}</p>}
          <PinPad value={pwd} onChange={setPwd} color={r.color}/>
        </div>
      </div>
    </div>
  );
}

function SetupPwd({ROLES,role,sPwd,setSPwd,sPwd2,setSPwd2,sErr,setSErr,auth,onSetup}){
  const r = ROLES[role] || {icon:"👤",label:role,color:"#8B5CF6"};
  const step = sPwd.length<4 ? 1 : 2;
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#0F172A,#1E293B)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{maxWidth:370,width:"100%",animation:"fadeIn .4s ease"}}>
        <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",borderRadius:22,padding:32,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{textAlign:"center",marginBottom:26}}>
            <div style={{fontSize:42,marginBottom:12}}>🔐</div>
            <h2 style={{fontSize:20,fontWeight:700,color:"#fff"}}>{step===1?"Choisissez un code à 4 chiffres":"Confirmez votre code"}</h2>
            <p style={{color:"#9AA8C4",fontSize:13,marginTop:3}}>Première connexion · {r.label}</p>
          </div>
          {sErr&&<p style={{color:"#FF8A8A",fontSize:12,textAlign:"center",marginBottom:14}}>{sErr}</p>}
          {step===1
            ? <PinPad value={sPwd} onChange={setSPwd} color={r.color}/>
            : <>
                <PinPad value={sPwd2} onChange={setSPwd2} color={r.color}/>
                <button onClick={()=>{setSPwd("");setSPwd2("");setSErr("");}} style={{display:"block",margin:"18px auto 0",background:"none",border:"none",color:"#9AA8C4",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Recommencer</button>
              </>}
        </div>
      </div>
    </div>
  );
}

/* ════════ SIDEBAR ════════ */
function Sidebar({ROLES,role,navItems,tab,setTab,reportees,todayOrders,livrees,enAttente,beneficeJour,depJour,canVoirMontants,onSettings,onLogout}){
  const r = ROLES[role]||{icon:"👤",label:role};
  return (
    <div style={{width:240,background:"var(--sidebar-bg)",minHeight:"100vh",position:"fixed",left:0,top:0,bottom:0,display:"flex",flexDirection:"column",zIndex:100,transition:"background .4s ease"}}>
      <div style={{padding:"22px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366F1,#4338CA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 14px rgba(79,70,229,0.4)"}}>🛍️</div>
          <div>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>Yah-ni Store</div>
            <div style={{color:"#818CF8",fontSize:11,fontWeight:600}}>{r.icon} {r.label}</div>
          </div>
        </div>
      </div>
      {canVoirMontants&&<div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{v:todayOrders.length,l:"Commandes",c:"#818CF8"},{v:livrees.length,l:"Livrées",c:"#34D399"},{v:fmt(beneficeJour-depJour)+"F",l:"Net jour",c:"#A78BFA"},{v:enAttente.length,l:"Attente",c:"#FBBF24"}].map(({v,l,c})=>(
            <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:15,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:10,color:"#6B7B9C",marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>
      </div>}
      <nav style={{flex:1,padding:12}}>
        {navItems.map(it=>(
          <button key={it.id} onClick={()=>setTab(it.id)} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"none",cursor:"pointer",background:tab===it.id?"rgba(99,102,241,0.18)":"transparent",color:tab===it.id?"#818CF8":"#94A3B8",display:"flex",alignItems:"center",gap:11,fontSize:14,fontWeight:tab===it.id?600:500,marginBottom:2,fontFamily:"inherit",textAlign:"left",transition:"all .15s"}}>
            <span style={{fontSize:17,width:22,textAlign:"center"}}>{it.icon}</span>{it.label}
            {it.id==="reportees"&&reportees.length>0&&<span style={{marginLeft:"auto",background:"#EF4444",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{reportees.length}</span>}
          </button>
        ))}
      </nav>
      <div style={{padding:12,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <button onClick={onSettings} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(255,255,255,0.04)",color:"#9AA8C4",display:"flex",alignItems:"center",gap:10,fontSize:13,fontFamily:"inherit",marginBottom:8}}>⚙️ Paramètres</button>
        <button onClick={onLogout} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:"#6B7B9C",display:"flex",alignItems:"center",gap:10,fontSize:13,fontFamily:"inherit"}}>🚪 Déconnexion</button>
      </div>
    </div>
  );
}

/* ════════ CARDS & TABS (suite dans le fichier) ════════ */
function Loader({text}){return (<div style={{textAlign:"center",padding:60}}><Spin size={32}/><p style={{color:"#9AA8C4",marginTop:14,fontSize:14}}>{text}</p></div>);}
function Empty({icon,title,sub}){return (<div style={{textAlign:"center",padding:60,color:"#9AA8C4"}}><div style={{fontSize:46,marginBottom:12}}>{icon}</div><p style={{fontSize:16,fontWeight:600,marginBottom:6}}>{title}</p>{sub?<p style={{fontSize:13}}>{sub}</p>:null}</div>);}
function OrderSkeleton(){
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18}}>
      {[0,1,2].map(col=>(
        <div key={col}>
          <div className="skel" style={{height:40,marginBottom:12}}/>
          {[0,1].map(k=>(
            <div key={k} className="card" style={{padding:"14px 16px",marginBottom:10}}>
              <div className="skel" style={{height:12,width:"40%",marginBottom:10}}/>
              <div className="skel" style={{height:16,width:"70%",marginBottom:8}}/>
              <div className="skel" style={{height:12,width:"55%",marginBottom:12}}/>
              <div style={{display:"flex",gap:8}}>
                <div className="skel" style={{height:34,flex:1}}/>
                <div className="skel" style={{height:34,flex:1}}/>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DateNav({viewDate,setViewDate}){
  const TODAY = new Date().toISOString().split("T")[0];
  function shift(days){
    const d = new Date(viewDate); d.setDate(d.getDate()+days);
    setViewDate(d.toISOString().split("T")[0]);
  }
  const dObj = new Date(viewDate);
  const isToday = viewDate===TODAY;
  const label = dObj.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const yest = new Date(); yest.setDate(yest.getDate()-1);
  const isYesterday = viewDate===yest.toISOString().split("T")[0];
  return (
    <div className="card" style={{padding:"10px 12px",marginBottom:18,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <button onClick={()=>shift(-1)} style={{width:38,height:38,borderRadius:10,border:"1px solid #E8ECF4",background:"#fff",cursor:"pointer",fontSize:16,color:"#5B6B8C"}}>‹</button>
      <div style={{flex:1,textAlign:"center",minWidth:140}}>
        <div style={{fontSize:15,fontWeight:700,textTransform:"capitalize"}}>{isToday?"Aujourd'hui":isYesterday?"Hier":label}</div>
        {!isToday&&<div style={{fontSize:11,color:"#9AA8C4",textTransform:"capitalize"}}>{label}</div>}
      </div>
      <button onClick={()=>shift(1)} style={{width:38,height:38,borderRadius:10,border:"1px solid #E8ECF4",background:"#fff",cursor:"pointer",fontSize:16,color:"#5B6B8C"}}>›</button>
      <input type="date" value={viewDate} onChange={e=>setViewDate(e.target.value)} style={{padding:"9px 12px",borderRadius:10,border:"1.5px solid #E8ECF4",background:"#fff",fontSize:13,fontFamily:"inherit",outline:"none",color:"#0F1B3C"}}/>
      {!isToday&&<button onClick={()=>setViewDate(TODAY)} style={{padding:"9px 14px",borderRadius:10,border:"none",background:"#FBF4E6",color:"#C99A4B",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Aujourd'hui</button>}
    </div>
  );
}

function initiales(nom){
  const parts=(nom||"?").trim().split(/\s+/);
  return ((parts[0]?.[0]||"")+(parts[1]?.[0]||parts[0]?.[1]||"")).toUpperCase()||"?";
}

function OrderCard({o,i,isPatron,seePrix,hist,onLivrer,onMotif,onWA,onCall,onSMS,onTransfer,viewDate,callFilter}){
  const [open,setOpen]=useState(false);
  const isDue = o.statut==="reportee" && o.reportDate===viewDate;
  const isLivree=o.statut==="livree",isBad=o.statut==="non_livree",isRep=o.statut==="reportee" && !isDue;
  const actionnable = o.statut==="en_attente" || isDue;
  const c=o.contacted||[], bc=badgeColor(o.commune);
  const borderColor = isLivree?"#10B981":isBad?"#EF4444":isRep?"#F59E0B":"#4F46E5";
  const prevOrders = (hist||[]).filter(e=>e.id!==o.shopifyId).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const nbPrev = prevOrders.length;
  const lastPrev = prevOrders[0];
  const lastPrevLabel = lastPrev ? (lastPrev.statut==="livree"?"précédente livrée ✓":lastPrev.statut==="non_livree"?"précédente NON livrée ✗":"précédente en cours") : "";
  const statutBadge = isLivree?{t:"✓ Livrée",bg:"#10B981",fg:"#fff"}:isBad?{t:"⚠️ Problème",bg:"#FDEAEA",fg:"#C0392B"}:isRep?{t:"⏰ Reporté",bg:"#FBF4E6",fg:"#C99A4B"}:isDue?{t:"↩️ Aujourd'hui",bg:"#FEF3C7",fg:"#B45309"}:{t:"🕐 En attente",bg:"var(--orange-bg,#FFF3E0)",fg:"#B45309"};

  return (
    <div className="card" style={{marginBottom:12,overflow:"hidden",padding:0,animation:`fadeIn .3s ease ${i*30}ms both`,boxShadow:open?"0 8px 24px rgba(79,70,229,.14)":undefined}}>

      {/* ── TÊTE COMPACTE (toujours visible, cliquable) ── */}
      <div onClick={()=>setOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:11,padding:14,cursor:"pointer"}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:bc+"1A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:bc,flexShrink:0}}>{initiales(o.client)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:15,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.client}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
            {o.heure&&<span style={{fontSize:12,fontWeight:800,color:"var(--text-soft,#334155)",background:"var(--bg,#F1F5F9)",borderRadius:8,padding:"1px 7px"}}>🕐 {o.heure}</span>}
            <span style={{fontSize:11,fontWeight:700,padding:"1px 8px",borderRadius:20,background:bc+"14",color:bc}}>{displayCommune(o.commune)}</span>
            {callFilter==="appelees"&&c.includes("appel")&&<span style={{fontSize:10,color:"#7C3AED",fontWeight:700}}>✓ {o.appelHeure||""}{o.appelPar?` · ${o.appelPar}`:""}</span>}
            {callFilter==="non_appelees"&&<span style={{fontSize:10,color:"#C0392B",fontWeight:700}}>{o.phone}</span>}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          {seePrix&&<div style={{fontSize:15,fontWeight:800,color:"#10B981"}}>{fmt(o.prix)} F</div>}
          <span style={{fontSize:10,fontWeight:800,borderRadius:20,padding:"2px 8px",display:"inline-block",marginTop:3,background:statutBadge.bg,color:statutBadge.fg}}>{statutBadge.t}</span>
        </div>
        <div style={{color:"#B7C0CE",fontSize:14,transition:"transform .2s",transform:open?"rotate(90deg)":"none"}}>›</div>
      </div>

      {/* ── DÉTAILS (au clic) ── */}
      {open&&<div style={{padding:"0 14px 14px",borderTop:"1px solid var(--border,#F1F5F9)"}}>

        <div style={{display:"flex",gap:5,margin:"10px 0 4px",flexWrap:"wrap",alignItems:"center"}}>
          {nbPrev>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:700}}>🔁 {nbPrev+1}ᵉ commande · {lastPrevLabel}</span>}
          {o.boutiqueNom&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:(o.boutiqueCouleur||"#6366F1")+"22",color:o.boutiqueCouleur||"#4F46E5",fontWeight:700}}>🏪 {o.boutiqueNom}</span>}
          {o.isManual&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>✍️ Manuel</span>}
          {c.includes("whatsapp")&&<span style={{fontSize:10,color:"#1E8E54",fontWeight:600}}>✓ WhatsApp</span>}
          {c.includes("sms")&&<span style={{fontSize:10,color:"#2563EB",fontWeight:600}}>✓ SMS</span>}
          {c.includes("appel")&&<span style={{fontSize:10,color:"#7C3AED",fontWeight:600}}>✓ Appelé{o.appelHeure?` à ${o.appelHeure}`:""}{o.appelPar?` par ${o.appelPar}`:""}</span>}
          {o.transferred&&<span style={{fontSize:10,color:"#B45309",fontWeight:600}}>🛵 Envoyée à {o.livreurNom||"livreur"}{o.transfertHeure?` à ${o.transfertHeure}`:""}</span>}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0 2px",fontSize:13,color:"var(--text-soft,#334155)"}}>📦 {o.produit}</div>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"2px 0",fontSize:13,color:"var(--text-soft,#334155)"}}>📍 <b>{displayCommune(o.commune)}</b>{o.adresse&&o.adresse!==o.commune?` — ${o.adresse}`:""}</div>
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"2px 0",fontSize:13,color:"var(--text-soft,#334155)"}}>📱 {o.phone||"—"}</div>
        {o.note&&<div style={{fontSize:12,color:"var(--text-mute,#9AA8C4)",padding:"2px 0"}}>📝 {o.note}</div>}
        {seePrix&&isPatron&&<div style={{fontSize:12,color:"var(--text-mute,#9AA8C4)",padding:"2px 0"}}>💰 Net : {fmt((o.prix||0)-o.livraison)} F</div>}
        {o.reportDate&&isRep&&<div style={{fontSize:12,color:"#C99A4B",padding:"2px 0",fontWeight:600}}>📅 Reporté au {o.reportDate}</div>}

        {isLivree&&(o.statutHeure||o.statutPar)&&<div style={{fontSize:12,color:"#1E8E54",fontWeight:600,marginTop:8}}>✓ Livrée{o.statutHeure?` à ${o.statutHeure}`:""}{o.statutPar?` par ${o.statutPar}`:""}</div>}
        {isBad&&<div style={{background:"#FDEAEA",borderRadius:10,padding:"9px 12px",marginTop:8,fontSize:12,color:"#C0392B",fontWeight:600}}>💬 Motif : {o.motif||"non précisé"}{o.statutPar?` — signalé par ${o.statutPar}`:""}{o.statutHeure?` à ${o.statutHeure}`:""}</div>}

        {/* Actions (commande en attente uniquement) */}
        {actionnable&&<>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={onCall} style={{flex:1,padding:"11px 4px",borderRadius:12,border:"none",background:"var(--bg,#F1F5F9)",color:"var(--text,#0F172A)",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📞 Appeler</button>
            <button onClick={onWA} style={{flex:1,padding:"11px 4px",borderRadius:12,border:"none",background:"#25D366",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>💬 WhatsApp</button>
            <button onClick={onSMS} style={{flex:1,padding:"11px 4px",borderRadius:12,border:"none",background:"#2563EB",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>✉️ SMS</button>
          </div>
          {!o.transferred
            ? <button onClick={onTransfer} style={{width:"100%",marginTop:8,padding:12,borderRadius:12,border:"none",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>📤 Envoyer la commande au livreur</button>
            : <div style={{marginTop:8,textAlign:"center",fontSize:12,color:"#B45309",fontWeight:600,padding:"6px 0"}}>✓ Déjà chez le livreur</div>}
          {!isPatron&&<div style={{display:"flex",gap:8,marginTop:8}}>
            <button onClick={onLivrer} style={{flex:1.4,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#10B981",color:"#fff",fontSize:13,fontWeight:800,fontFamily:"inherit"}}>✓ Livré</button>
            <button onClick={onMotif} style={{flex:1,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#FDEAEA",color:"#C0392B",fontSize:13,fontWeight:800,fontFamily:"inherit"}}>✗ Problème</button>
          </div>}
        </>}
      </div>}
    </div>
  );
}

function LivreurCard({o,i,onUpdate,onCall,onPasLivre}){
  const [showMotifs,setShowMotifs]=useState(false);
  const st=o.livreurStatut||"en_attente";
  const isLivre = st==="livre" || o.statut==="livree";
  const isPasLivre = o.statut==="non_livree";
  const steps=[{id:"en_route",l:"En route",icon:"🚗"},{id:"arrive",l:"Arrivé",icon:"📍"}];
  const stepIdx=st==="arrive"?1:st==="en_route"?0:-1;
  const MOTIFS_LIVREUR=["Client a refusé le produit","Client n'a pas décroché","Client absent / adresse introuvable","À reporter (client indisponible)","Je n'ai pas eu le temps","Commande annulée"];
  const waMsg=`Bonjour ${o.client}, je suis votre livreur Yah-ni Store. Je vous apporte votre colis : ${o.produit}. Montant à prévoir : ${fmt(o.prix)} F. À tout de suite !`;
  return (
    <div className="card" style={{padding:18,marginBottom:14,animation:`fadeIn .3s ease ${i*50}ms both`,borderLeft:`4px solid ${isLivre?"#2BB673":isPasLivre?"#EF4444":"#E5B567"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:18,fontWeight:700}}>{o.client}</div>
          <div style={{fontSize:13,color:"#5B6B8C",marginTop:2}}>📦 {o.produit}{o.heure?` · 🕐 ${o.heure}`:""}</div>
        </div>
        {isLivre&&<span style={{fontSize:12,padding:"4px 10px",borderRadius:20,background:"#E3F7EE",color:"#1E8E54",fontWeight:700,height:"fit-content"}}>✓ Livré</span>}
        {isPasLivre&&<span style={{fontSize:12,padding:"4px 10px",borderRadius:20,background:"#FDEAEA",color:"#C0392B",fontWeight:700,height:"fit-content"}}>✗ Pas livré</span>}
      </div>
      <div style={{background:"#E8F1FE",borderRadius:12,padding:14,marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:24,flexShrink:0}}>📍</span>
        <div style={{minWidth:0}}>
          <div style={{fontSize:17,fontWeight:800,color:"#1D4ED8"}}>{displayCommune(o.commune)}</div>
          {o.adresse&&o.adresse!==o.commune&&<div style={{fontSize:14,color:"#2563EB",fontWeight:500}}>{o.adresse}</div>}
        </div>
      </div>
      <div style={{background:"#F7F8FB",borderRadius:12,padding:"10px 14px",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>📞</span><span style={{fontSize:14,color:"#5B6B8C"}}>{o.phone}</span></div>
      </div>
      <div style={{background:"#E3F7EE",borderRadius:12,padding:"12px 14px",marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:11,color:"#1E8E54",marginBottom:2}}>Montant à encaisser</div>
        <div style={{fontSize:26,fontWeight:800,color:"#10B981"}}>{fmt(o.prix)} F</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>onCall(o)} style={{flex:1,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#E8F1FE",color:"#2563EB",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>📞 Appeler</button>
        <button onClick={()=>{const p=(o.phone||"").replace(/\D/g,""); if(p) window.open(`https://wa.me/${p}?text=${encodeURIComponent(waMsg)}`,"_blank");}} style={{flex:1,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#25D366",color:"#fff",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>💬 WhatsApp</button>
        <button onClick={()=>window.open(`https://maps.google.com/?q=${encodeURIComponent(o.adresse||o.commune)}`,"_blank")} style={{flex:1,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#F3E8FF",color:"#7C3AED",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>🗺️ Itinéraire</button>
      </div>
      {!isLivre&&!isPasLivre&&<div style={{display:"flex",gap:6,marginBottom:10}}>
        {steps.map((s,idx)=>(
          <button key={s.id} onClick={()=>onUpdate(o,s.id)} style={{flex:1,padding:"10px 6px",borderRadius:10,border:"none",cursor:"pointer",background:idx<=stepIdx?"#E5B567":"#F2F4F8",color:idx<=stepIdx?"#fff":"#9AA8C4",fontSize:12,fontWeight:700,fontFamily:"inherit",transition:"all .15s"}}>
            {s.icon} {s.l}
          </button>
        ))}
      </div>}
      {!isLivre&&!isPasLivre&&!showMotifs&&<div style={{display:"flex",gap:8}}>
        <button onClick={()=>onUpdate(o,"livre")} style={{flex:1.4,padding:14,borderRadius:12,border:"none",cursor:"pointer",background:"#10B981",color:"#fff",fontSize:15,fontWeight:800,fontFamily:"inherit"}}>✓ Livré</button>
        <button onClick={()=>setShowMotifs(true)} style={{flex:1,padding:14,borderRadius:12,border:"none",cursor:"pointer",background:"#FDEAEA",color:"#C0392B",fontSize:15,fontWeight:800,fontFamily:"inherit"}}>✗ Pas livré</button>
      </div>}
      {!isLivre&&!isPasLivre&&showMotifs&&<div style={{background:"#FEF6F6",borderRadius:12,padding:12,border:"1px solid #F5C2C2"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#C0392B",marginBottom:10}}>Pourquoi la commande n'a pas été livrée ?</div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {MOTIFS_LIVREUR.map(m=>(
            <button key={m} onClick={()=>{onPasLivre(o,m);setShowMotifs(false);}} style={{textAlign:"left",padding:"11px 13px",borderRadius:10,border:"1px solid #F0D0D0",background:"#fff",color:"#8B2E2E",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{m}</button>
          ))}
        </div>
        <button onClick={()=>setShowMotifs(false)} style={{width:"100%",marginTop:10,padding:10,borderRadius:10,border:"none",background:"#F2F4F8",color:"#5B6B8C",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>← Annuler</button>
      </div>}
      {isPasLivre&&o.motif&&<div style={{marginTop:4,background:"#FDEAEA",borderRadius:10,padding:"9px 12px",fontSize:12,color:"#C0392B",fontWeight:600}}>💬 {o.motif}</div>}
    </div>
  );
}

/* ════════ BILAN ════════ */
function Bilan({orders,depenses,produits,mode,setMode,date,setDate,setTab}){
  const subset = mode==="jour"?orders.filter(o=>o.date===TODAY):mode==="date"?orders.filter(o=>o.date===date):orders;
  const depSub = mode==="jour"?depenses.filter(d=>d.date===TODAY):mode==="date"?depenses.filter(d=>d.date===date):depenses;
  const livrees=subset.filter(o=>o.statut==="livree");
  const encaisse=livrees.reduce((s,o)=>s+(o.prix||0),0);
  const frais=livrees.reduce((s,o)=>s+o.livraison,0);
  const brut=encaisse-frais;
  const totalDep=depSub.reduce((s,d)=>s+d.montant,0);
  const reel=brut-totalDep;
  const taux=subset.length?Math.round(livrees.length/subset.length*100):0;
  const parCat=CAT_DEP.map(c=>({...c,total:depSub.filter(d=>d.categorie===c.id).reduce((s,d)=>s+d.montant,0)})).filter(c=>c.total>0);
  // Bilan par produit (sur les commandes livrées)
  const parProduit={};
  livrees.forEach(o=>{
    const key=o.produit||"Autre";
    if(!parProduit[key])parProduit[key]={nom:key,qte:0,encaisse:0,nbCommandes:0};
    parProduit[key].qte+=o.quantite||1;
    parProduit[key].encaisse+=o.prix||0;
    parProduit[key].nbCommandes+=1;
  });
  const produitsList=Object.values(parProduit).sort((a,b)=>b.encaisse-a.encaisse);
  return (
    <div className="fadeIn">
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[{id:"jour",l:"Aujourd'hui"},{id:"global",l:"Global"},{id:"date",l:"Par date"}].map(({id,l})=>(
          <button key={id} onClick={()=>setMode(id)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${mode===id?"#E5B567":"#E8ECF4"}`,background:mode===id?"#FBF4E6":"#fff",color:mode===id?"#C99A4B":"#5B6B8C",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
        ))}
        {mode==="date"&&<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input" style={{width:"auto"}}/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        <Stat label="Encaissé" value={fmt(encaisse)+" F"} icon="💰" color="#E5B567" sub={`${livrees.length} livraisons`}/>
        <Stat label="Part livreur" value={"-"+fmt(frais)+" F"} icon="🛵" color="#E5484D"/>
        <Stat label="Bénéfice brut" value={fmt(brut)+" F"} icon="📈" color="#2BB673"/>
        <Stat label="Commandes" value={subset.length} icon="📦" color="#8B5CF6"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginBottom:18}}>
        <div className="card" style={{padding:20,borderLeft:"3px solid #E5484D"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div><div style={{fontSize:11,color:"#5B6B8C",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>📉 Dépenses</div><div style={{fontSize:23,fontWeight:800,color:"#E5484D"}}>-{fmt(totalDep)} F</div></div>
            <button onClick={()=>setTab("depenses")} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #FDEAEA",background:"#FDEAEA",color:"#C0392B",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Voir →</button>
          </div>
          {parCat.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"#5B6B8C"}}>{c.icon} {c.label}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>-{fmt(c.total)} F</span></div>)}
          {parCat.length===0&&<p style={{fontSize:12,color:"#CBD5E8"}}>Aucune dépense</p>}
        </div>
        <div className="card" style={{padding:20,background:reel>=0?"linear-gradient(135deg,#E3F7EE,#F0FBF5)":"linear-gradient(135deg,#FDEAEA,#FEF5F5)",borderLeft:`3px solid ${reel>=0?"#2BB673":"#E5484D"}`}}>
          <div style={{fontSize:11,color:"#5B6B8C",fontWeight:600,textTransform:"uppercase",marginBottom:8}}>🎯 Résultat réel</div>
          <div style={{fontSize:30,fontWeight:800,color:reel>=0?"#1E8E54":"#C0392B",letterSpacing:"-1px"}}>{reel>=0?"+":""}{fmt(reel)} F</div>
          <div style={{fontSize:12,color:"#5B6B8C",marginTop:8}}>Brut {fmt(brut)} F − Dépenses {fmt(totalDep)} F</div>
        </div>
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontWeight:700,fontSize:15}}>Taux de livraison</span>
          <span style={{fontSize:26,fontWeight:800,color:taux>70?"#2BB673":taux>40?"#E5B567":"#E5484D"}}>{taux}%</span>
        </div>
        <div style={{background:"#F2F4F8",borderRadius:20,height:12,overflow:"hidden",marginBottom:12}}>
          <div style={{width:taux+"%",height:"100%",background:taux>70?"linear-gradient(90deg,#2BB673,#48D596)":taux>40?"linear-gradient(90deg,#E5B567,#F0C674)":"linear-gradient(90deg,#E5484D,#F87171)",borderRadius:20,transition:"width .8s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#5B6B8C",flexWrap:"wrap",gap:8}}>
          <span>✅ {livrees.length} livrées</span><span>✗ {subset.filter(o=>o.statut==="non_livree").length} échouées</span><span>⏳ {subset.filter(o=>o.statut==="en_attente").length} attente</span><span>Total {subset.length}</span>
        </div>
      </div>

      <div className="card" style={{padding:20,marginTop:18}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📦 Bilan par produit</div>
        {produitsList.length===0?<p style={{fontSize:13,color:"#CBD5E8"}}>Aucune vente livrée sur cette période</p>:
          produitsList.map((p,i)=>{
            const maxEnc=produitsList[0].encaisse||1;
            const pct=Math.round((p.encaisse/maxEnc)*100);
            return (
              <div key={p.nom} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:600,flex:1,marginRight:8}}>{p.nom}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#2BB673"}}>{fmt(p.encaisse)} F</span>
                </div>
                <div style={{background:"#F2F4F8",borderRadius:20,height:8,overflow:"hidden",marginBottom:4}}>
                  <div style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,#E5B567,#F0C674)",borderRadius:20,transition:"width .6s ease"}}/>
                </div>
                <div style={{fontSize:11,color:"#9AA8C4"}}>{p.qte} unités vendues · {p.nbCommandes} commande{p.nbCommandes>1?"s":""}</div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* ════════ DÉPENSES ════════ */
function DepensesTab({depenses,filter,setFilter,onAdd,onDel}){
  const filtered=depenses.filter(d=>filter==="tout"||d.categorie===filter);
  return (
    <div className="fadeIn">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <Stat label="Aujourd'hui" value={"-"+fmt(depenses.filter(d=>d.date===TODAY).reduce((s,d)=>s+d.montant,0))+" F"} icon="📉" color="#E5484D"/>
        <Stat label="Total" value={"-"+fmt(depenses.reduce((s,d)=>s+d.montant,0))+" F"} icon="💸" color="#C0392B"/>
      </div>
      <button onClick={onAdd} style={{width:"100%",padding:14,borderRadius:14,border:"2px dashed #F0DFB8",background:"#FBF4E6",color:"#C99A4B",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>➕ Saisir une dépense</button>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>setFilter("tout")} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",background:filter==="tout"?"#0F1B3C":"#fff",color:filter==="tout"?"#fff":"#5B6B8C",fontSize:12,fontWeight:600,fontFamily:"inherit",border:"1px solid #E8ECF4"}}>Tout</button>
        {CAT_DEP.map(c=><button key={c.id} onClick={()=>setFilter(c.id)} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",background:filter===c.id?c.color:"#fff",color:filter===c.id?"#fff":"#5B6B8C",fontSize:12,fontWeight:600,fontFamily:"inherit",border:`1px solid ${filter===c.id?c.color:"#E8ECF4"}`}}>{c.icon} {c.label}</button>)}
      </div>
      {filtered.length===0?<Empty icon="📉" title="Aucune dépense"/>:filtered.map(d=>{const c=catDep(d.categorie);return(
        <div key={d.id} className="card fadeIn" style={{padding:"14px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:c.color+"18",color:c.color,fontWeight:600}}>{c.icon} {c.label}</span>
              <span style={{fontSize:11,color:"#9AA8C4"}}>{d.date}</span>
              {d.auteur&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>👤 par {d.auteur}</span>}
            </div>
            <div style={{fontWeight:600,fontSize:14}}>{d.libelle}</div>
            {d.note&&<div style={{fontSize:12,color:"#9AA8C4",marginTop:2}}>{d.note}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{textAlign:"right"}}><div style={{fontSize:17,fontWeight:800,color:"#E5484D"}}>-{fmt(d.montant)}</div><div style={{fontSize:10,color:"#9AA8C4"}}>FCFA</div></div>
            <button onClick={()=>onDel(d.id)} style={{width:32,height:32,borderRadius:8,border:"1px solid #FDEAEA",background:"#FDEAEA",color:"#E5484D",cursor:"pointer",fontSize:14}}>🗑</button>
          </div>
        </div>
      );})}
    </div>
  );
}

/* ════════ STOCK ════════ */
function StockTab({produits,canGerer,canVoirMontants,loading,onAdd,onDel,onLink}){
  return (
    <div className="fadeIn">
      {!canVoirMontants&&<div style={{background:"#E8F1FE",border:"1px solid #BcDcFc",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#2563EB"}}>👁️ Vue quantités — montants non visibles pour votre rôle</div>}
      {canGerer&&<button onClick={onAdd} style={{width:"100%",padding:14,borderRadius:14,border:"2px dashed #F0DFB8",background:"#FBF4E6",color:"#C99A4B",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>➕ Ajouter un produit</button>}
      {loading?<Loader text="Chargement..."/>:produits.length===0?<Empty icon="📦" title="Aucun produit" sub={canGerer?"Ajoutez votre premier produit":"Aucun produit en stock"}/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16}}>
        {produits.map(p=>{
          const vendu=p.stock_initial-p.stock_actuel;
          const pct=p.stock_initial>0?Math.round(vendu/p.stock_initial*100):0;
          const alerte=p.stock_actuel<=(p.seuil_alerte||10);
          const coutTotal=(p.cout_achat||0)+(p.cout_fret||0);
          const marge=p.prix_vente-coutTotal;
          return(
            <div key={p.id} className="card fadeIn" style={{padding:18,border:`1px solid ${alerte?"#F5C2C2":"#E8ECF4"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                {p.image?<img src={p.image} alt={p.nom} style={{width:48,height:48,borderRadius:12,objectFit:"cover"}}/>:<div style={{width:48,height:48,borderRadius:12,background:"#FBF4E6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{p.emoji||"📦"}</div>}
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{p.nom}</div>
                  <div style={{fontSize:11,color:"#9AA8C4"}}>{p.categorie}{p.conditionnement?` · ${p.conditionnement}`:""}</div>
                </div>
                {alerte&&<span style={{fontSize:10,color:"#C0392B",fontWeight:700,background:"#FDEAEA",padding:"3px 8px",borderRadius:20}}>⚠️</span>}
                {canGerer&&<button onClick={()=>onDel(p.id)} style={{width:28,height:28,borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#9AA8C4",cursor:"pointer",fontSize:12}}>🗑</button>}
              </div>
              {canGerer&&(p.shopify_id
                ? <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,fontSize:11,color:"#1E8E54",background:"#E3F7EE",borderRadius:8,padding:"6px 10px"}}>🔗 Lié à Shopify <button onClick={()=>onLink(p.id)} style={{marginLeft:"auto",border:"none",background:"none",color:"#1E8E54",fontWeight:700,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Changer</button></div>
                : <button onClick={()=>onLink(p.id)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",marginBottom:12,fontSize:11,color:"#C0392B",background:"#FDEAEA",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>⚠️ Non lié à Shopify — le stock ne se décrémentera pas automatiquement. Lier maintenant</button>
              )}
              {canVoirMontants&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:80,background:"#F7F8FB",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,color:"#9AA8C4"}}>Coût (Chine+Fret)</div><div style={{fontSize:13,fontWeight:700,color:"#E5484D"}}>{fmt(coutTotal)} F</div></div>
                <div style={{flex:1,minWidth:80,background:"#F7F8FB",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,color:"#9AA8C4"}}>Vente</div><div style={{fontSize:13,fontWeight:700,color:"#2BB673"}}>{fmt(p.prix_vente)} F</div></div>
                <div style={{flex:1,minWidth:80,background:"#F7F8FB",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,color:"#9AA8C4"}}>Marge/u</div><div style={{fontSize:13,fontWeight:700,color:"#8B5CF6"}}>{fmt(marge)} F</div></div>
              </div>}
              <div style={{background:"#F2F4F8",borderRadius:20,height:8,overflow:"hidden",marginBottom:10}}>
                <div style={{width:pct+"%",height:"100%",background:alerte?"linear-gradient(90deg,#E5484D,#F2922C)":pct>70?"linear-gradient(90deg,#E5B567,#E5484D)":"linear-gradient(90deg,#2BB673,#3B82F6)",borderRadius:20,transition:"width .6s ease"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
                {[{l:"Vendus",v:vendu,c:"#2BB673"},{l:"Restant",v:p.stock_actuel,c:alerte?"#E5484D":"#0F1B3C"},{l:"Initial",v:p.stock_initial,c:"#9AA8C4"}].map(({l,v,c})=>(
                  <div key={l} style={{background:"#F7F8FB",borderRadius:8,padding:"8px 4px"}}><div style={{fontSize:19,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:10,color:"#9AA8C4",marginTop:1}}>{l}</div></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

/* ════════ WISHLIST ════════ */
function WishlistTab({items,onAdd,onDel}){
  return (
    <div className="fadeIn">
      <div style={{background:"#F3E8FF",border:"1px solid #E0C8FF",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#7C3AED"}}>⭐ Vos produits repérés à commander plus tard (Alibaba, etc.)</div>
      <button onClick={onAdd} style={{width:"100%",padding:14,borderRadius:14,border:"2px dashed #E0C8FF",background:"#F9F5FF",color:"#7C3AED",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>➕ Ajouter un produit à sourcer</button>
      {items.length===0?<Empty icon="⭐" title="Wishlist vide" sub="Ajoutez les produits qui vous plaisent"/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:16}}>
        {items.map(w=>(
          <div key={w.id} className="card fadeIn" style={{overflow:"hidden"}}>
            <div style={{height:160,background:"#F2F4F8",position:"relative"}}>
              {w.image?<img src={w.image} alt={w.nom} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:40}}>📦</div>}
              <button onClick={()=>onDel(w.id)} style={{position:"absolute",top:8,right:8,width:30,height:30,borderRadius:8,border:"none",background:"rgba(255,255,255,0.9)",color:"#E5484D",cursor:"pointer",fontSize:13}}>🗑</button>
            </div>
            <div style={{padding:14}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{w.nom}</div>
              {w.prix_estime>0&&<div style={{fontSize:13,color:"#7C3AED",fontWeight:600,marginBottom:6}}>≈ {fmt(w.prix_estime)} F</div>}
              {w.source&&<div style={{fontSize:11,color:"#9AA8C4",marginBottom:8}}>🏷️ {w.source}</div>}
              {w.note&&<div style={{fontSize:11,color:"#5B6B8C",marginBottom:8}}>{w.note}</div>}
              {w.lien&&<a href={w.lien} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",padding:"8px",borderRadius:8,background:"#7C3AED",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>🔗 Voir le produit</a>}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

/* ════════ SHEETS ════════ */
function AddOrderSheet({newOrder,setNewOrder,produits,onClose,onAdd}){
  return <Sheet onClose={onClose} title="✍️ Commande manuelle">
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Nom du client *"><input value={newOrder.client} onChange={e=>setNewOrder(p=>({...p,client:e.target.value}))} placeholder="Ex: Kofi Mensah" className="input"/></Field>
      <Field label="Téléphone *"><input type="tel" value={newOrder.phone} onChange={e=>setNewOrder(p=>({...p,phone:e.target.value}))} placeholder="0701234567" className="input"/></Field>
      <Field label="Produit"><select value={newOrder.produit} onChange={e=>setNewOrder(p=>({...p,produit:e.target.value}))} className="input"><option value="">Choisir</option>{produits.map(p=><option key={p.id} value={p.nom}>{p.nom} (stock {p.stock_actuel})</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Quantité"><input type="number" min="1" value={newOrder.qte} onChange={e=>setNewOrder(p=>({...p,qte:e.target.value}))} className="input"/></Field>
        <Field label="Commune"><select value={newOrder.commune} onChange={e=>setNewOrder(p=>({...p,commune:e.target.value}))} className="input">{COMMUNES.map(c=><option key={c} value={c}>{c}</option>)}<option value="Bouaké">Bouaké</option><option value="Inconnu">Inconnue</option></select></Field>
      </div>
      <Field label="Note"><input value={newOrder.note} onChange={e=>setNewOrder(p=>({...p,note:e.target.value}))} placeholder="Instructions..." className="input"/></Field>
      <div style={{display:"flex",gap:10,marginTop:4}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1}}>Annuler</button>
        <button onClick={onAdd} disabled={!newOrder.client||!newOrder.phone} className="btn btn-gold" style={{flex:2}}>✓ Ajouter</button>
      </div>
    </div>
  </Sheet>;
}

function AddProdSheet({newProd,setNewProd,onClose,onAdd,onLinkShopify}){
  return <Sheet onClose={onClose} title="📦 Nouveau produit">
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {newProd.shopifyId
        ? <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#1E8E54",background:"#E3F7EE",borderRadius:10,padding:"10px 12px"}}>🔗 Lié à « {newProd.shopifyNom} » <button onClick={()=>setNewProd(p=>({...p,shopifyId:"",shopifyNom:""}))} style={{marginLeft:"auto",border:"none",background:"none",color:"#1E8E54",fontWeight:700,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Retirer</button></div>
        : <button onClick={onLinkShopify} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px dashed #BcDcFc",background:"#E8F1FE",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🔗 Choisir depuis Shopify (recommandé)</button>}
      <Field label="Nom du produit *"><input value={newProd.nom} onChange={e=>setNewProd(p=>({...p,nom:e.target.value}))} placeholder="Ex: Montre connectée X8" className="input"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Stock initial *"><input type="number" value={newProd.stockInitial} onChange={e=>setNewProd(p=>({...p,stockInitial:e.target.value}))} placeholder="500" className="input"/></Field>
        <Field label="Conditionnement"><input value={newProd.conditionnement} onChange={e=>setNewProd(p=>({...p,conditionnement:e.target.value}))} placeholder="2 boîtes" className="input"/></Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Coût achat Chine (F)"><input type="number" value={newProd.coutAchat} onChange={e=>setNewProd(p=>({...p,coutAchat:e.target.value}))} placeholder="5000" className="input"/></Field>
        <Field label="Coût fret (F)"><input type="number" value={newProd.coutFret} onChange={e=>setNewProd(p=>({...p,coutFret:e.target.value}))} placeholder="2000" className="input"/></Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Prix de vente (F)"><input type="number" value={newProd.prixVente} onChange={e=>setNewProd(p=>({...p,prixVente:e.target.value}))} placeholder="12000" className="input"/></Field>
        <Field label="Alerte stock bas"><input type="number" value={newProd.seuilAlerte} onChange={e=>setNewProd(p=>({...p,seuilAlerte:e.target.value}))} placeholder="10" className="input"/></Field>
      </div>
      <Field label="Lien image (optionnel)"><input value={newProd.image} onChange={e=>setNewProd(p=>({...p,image:e.target.value}))} placeholder="https://..." className="input"/></Field>
      <div style={{display:"flex",gap:10,marginTop:4}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1}}>Annuler</button>
        <button onClick={onAdd} disabled={!newProd.nom||!newProd.stockInitial} className="btn btn-gold" style={{flex:2}}>✓ Ajouter</button>
      </div>
    </div>
  </Sheet>;
}

function ShopifyProductPicker({onClose,onSelect}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState("");
  const [err,setErr]=useState("");
  useEffect(()=>{
    fetch("/api/shopify-products").then(r=>r.json()).then(d=>{
      if(d.error) setErr(d.error); else setItems(d.products||[]);
      setLoading(false);
    }).catch(()=>{setErr("Erreur de connexion à Shopify");setLoading(false);});
  },[]);
  const filtered = items.filter(p=>p.nom.toLowerCase().includes(q.toLowerCase()));
  return <Sheet onClose={onClose} title="🔗 Choisir un produit Shopify">
    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un produit..." className="input" style={{marginBottom:12}}/>
    {loading?<Loader text="Chargement des produits Shopify..."/>:
     err?<div style={{fontSize:13,color:"#C0392B",background:"#FDEAEA",borderRadius:10,padding:"12px 14px"}}>⚠️ {err}</div>:
     filtered.length===0?<Empty icon="🔍" title="Aucun produit trouvé"/>:
    <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:420,overflowY:"auto"}}>
      {filtered.map(p=>(
        <button key={p.shopifyId} onClick={()=>onSelect(p)} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,border:"1px solid #E8ECF4",background:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
          {p.image?<img src={p.image} alt={p.nom} style={{width:38,height:38,borderRadius:8,objectFit:"cover"}}/>:<div style={{width:38,height:38,borderRadius:8,background:"#F2F4F8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📦</div>}
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{p.nom}</div>
            <div style={{fontSize:11,color:"#9AA8C4"}}>{fmt(p.prixVente)} F · stock Shopify {p.stock}{p.boutiqueNom?` · 🏪 ${p.boutiqueNom}`:""}</div>
          </div>
        </button>
      ))}
    </div>}
  </Sheet>;
}

function AddDepSheet({newDep,setNewDep,onClose,onAdd}){
  return <Sheet onClose={onClose} title="➕ Nouvelle dépense">
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Libellé *"><input value={newDep.libelle} onChange={e=>setNewDep(p=>({...p,libelle:e.target.value}))} placeholder="Ex: Emballages kraft" className="input"/></Field>
      <Field label="Montant (FCFA) *"><input type="number" value={newDep.montant} onChange={e=>setNewDep(p=>({...p,montant:e.target.value}))} placeholder="30000" className="input"/></Field>
      <Field label="Catégorie">
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CAT_DEP.map(c=><button key={c.id} onClick={()=>setNewDep(p=>({...p,categorie:c.id}))} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${newDep.categorie===c.id?c.color:"#E8ECF4"}`,background:newDep.categorie===c.id?c.color+"18":"#fff",color:newDep.categorie===c.id?c.color:"#5B6B8C",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{c.icon} {c.label}</button>)}</div>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Date"><input type="date" value={newDep.date} onChange={e=>setNewDep(p=>({...p,date:e.target.value}))} className="input"/></Field>
        <Field label="Note"><input value={newDep.note} onChange={e=>setNewDep(p=>({...p,note:e.target.value}))} placeholder="Détails" className="input"/></Field>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1}}>Annuler</button>
        <button onClick={onAdd} disabled={!newDep.libelle||!newDep.montant} className="btn btn-gold" style={{flex:2}}>✓ Enregistrer</button>
      </div>
    </div>
  </Sheet>;
}

function AddWishSheet({newWish,setNewWish,onClose,onAdd}){
  return <Sheet onClose={onClose} title="⭐ Produit à sourcer">
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Nom du produit *"><input value={newWish.nom} onChange={e=>setNewWish(p=>({...p,nom:e.target.value}))} placeholder="Ex: Écouteurs sans fil" className="input"/></Field>
      <Field label="Lien image"><input value={newWish.image} onChange={e=>setNewWish(p=>({...p,image:e.target.value}))} placeholder="Collez l'URL de l'image" className="input"/></Field>
      <Field label="Lien du produit (Alibaba...)"><input value={newWish.lien} onChange={e=>setNewWish(p=>({...p,lien:e.target.value}))} placeholder="https://alibaba.com/..." className="input"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Prix estimé (F)"><input type="number" value={newWish.prixEstime} onChange={e=>setNewWish(p=>({...p,prixEstime:e.target.value}))} placeholder="5000" className="input"/></Field>
        <Field label="Source"><input value={newWish.source} onChange={e=>setNewWish(p=>({...p,source:e.target.value}))} placeholder="Alibaba" className="input"/></Field>
      </div>
      <Field label="Note"><input value={newWish.note} onChange={e=>setNewWish(p=>({...p,note:e.target.value}))} placeholder="Pourquoi ce produit..." className="input"/></Field>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1}}>Annuler</button>
        <button onClick={onAdd} disabled={!newWish.nom} className="btn" style={{flex:2,background:"linear-gradient(135deg,#8B5CF6,#7C3AED)",color:"#fff"}}>✓ Ajouter</button>
      </div>
    </div>
  </Sheet>;
}

function Field({label,children}){return <div><label style={{display:"block",fontSize:12,color:"#5B6B8C",marginBottom:5,fontWeight:500}}>{label}</label>{children}</div>;}

/* ════════ RELANCE CLIENTS ÉCHOUÉS ════════ */
function RelanceTab({orders,settings,toast}){
  const echoues = orders.filter(o=>o.statut==="non_livree");
  // grouper par produit
  const groupes = {};
  echoues.forEach(o=>{ const k=o.produit||"Autre"; if(!groupes[k])groupes[k]=[]; groupes[k].push(o); });
  const [tpl,setTpl] = useState("Bonjour {nom} 👋\n\nVotre commande Yah-ni Store n'a pas pu être livrée. Souhaitez-vous la recevoir ? Nous sommes disponibles aujourd'hui pour vous livrer 📦\n\n{produit}\n\nMerci de nous confirmer 🙏");

  function relancer(o){
    const msg = tpl.replace("{nom}",o.client).replace("{produit}",o.produit).replace("{prix}",fmt(o.prix));
    window.open(`https://wa.me/${(o.phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank");
  }

  return (
    <div className="fadeIn">
      <div style={{background:"#FDEAEA",border:"1px solid #F5C2C2",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#C0392B"}}>🔄 Relancez les clients dont la commande a échoué. Chaque message rappelle le produit commandé. Vous validez chaque envoi (sûr pour votre compte WhatsApp).</div>

      <div className="card" style={{padding:16,marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>✏️ Message de relance (variables : {"{nom}"} {"{produit}"} {"{prix}"})</div>
        <textarea value={tpl} onChange={e=>setTpl(e.target.value)} className="input" style={{minHeight:110,resize:"vertical"}}/>
      </div>

      {echoues.length===0?<Empty icon="✅" title="Aucune commande échouée" sub="Toutes vos commandes sont livrées ou en cours"/>:
        Object.entries(groupes).map(([prod,items])=>(
          <div key={prod} style={{marginBottom:22}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 14px",background:"#FBF4E6",borderRadius:10}}>
              <span style={{fontWeight:700,fontSize:14,color:"#C99A4B"}}>📦 {prod}</span>
              <span style={{marginLeft:"auto",background:"#E5484D",color:"#fff",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{items.length}</span>
            </div>
            {items.map((o,i)=>(
              <div key={o.shopifyId} className="card fadeIn" style={{padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,animation:`fadeIn .3s ease ${i*40}ms both`}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{o.client}</div>
                  <div style={{fontSize:12,color:"#9AA8C4"}}>📞 {o.phone} · {o.commune}{o.motif?` · ${o.motif}`:""}</div>
                </div>
                <button onClick={()=>relancer(o)} className="btn" style={{background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",padding:"9px 14px"}}>💬 Relancer</button>
              </div>
            ))}
          </div>
        ))
      }
    </div>
  );
}

/* ════════ BASE CLIENTS PAR CATÉGORIE ════════ */
function ClientsTab({clients,settings,toast,onDel}){
  const [filtreCat,setFiltreCat] = useState("tout");
  const [search,setSearch] = useState("");
  const [pubMsg,setPubMsg] = useState("Bonjour {nom} 👋\n\nDe nouveaux produits viennent d'arriver chez Yah-ni Store ! 🛍️ Venez découvrir nos nouveautés.\n\nÀ bientôt 🙏");

  // toutes les catégories présentes
  const allCats = new Set();
  clients.forEach(c=>(c.categories||"").split("|").filter(Boolean).forEach(cat=>allCats.add(cat)));
  const cats = ["tout",...[...allCats]];

  const filtered = clients.filter(c=>{
    const okCat = filtreCat==="tout" || (c.categories||"").split("|").includes(filtreCat);
    const okSearch = !search || c.nom?.toLowerCase().includes(search.toLowerCase()) || (c.phone||"").includes(search);
    return okCat && okSearch;
  });

  function envoyerPub(c){
    const msg = pubMsg.replace("{nom}",c.nom).replace("{produit}",(c.produits||"").split("|")[0]||"");
    window.open(`https://wa.me/${(c.phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,"_blank");
  }

  return (
    <div className="fadeIn">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:18}}>
        <Stat label="Total clients" value={clients.length} icon="👥" color="#E5B567"/>
        <Stat label="Catégories" value={[...allCats].length} icon="🏷️" color="#8B5CF6"/>
        <Stat label="Filtrés" value={filtered.length} icon="🔍" color="#3B82F6"/>
      </div>

      <div style={{background:"#E8F1FE",border:"1px solid #BcDcFc",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#2563EB",lineHeight:1.5}}>
        💡 Vos clients sont rangés automatiquement par produit/catégorie acheté. Pour la pub, l'envoi se fait client par client (1 clic = WhatsApp s'ouvre prêt) — c'est la méthode sûre qui protège votre numéro. L'envoi automatique en masse arrivera avec l'API officielle WhatsApp.
      </div>

      <div className="card" style={{padding:16,marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>📢 Message publicitaire (variables : {"{nom}"} {"{produit}"})</div>
        <textarea value={pubMsg} onChange={e=>setPubMsg(e.target.value)} className="input" style={{minHeight:90,resize:"vertical"}}/>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un client (nom ou téléphone)" className="input" style={{marginBottom:12}}/>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {cats.map(c=><button key={c} onClick={()=>setFiltreCat(c)} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",background:filtreCat===c?"#0F1B3C":"#fff",color:filtreCat===c?"#fff":"#5B6B8C",fontSize:12,fontWeight:600,fontFamily:"inherit",border:"1px solid #E8ECF4"}}>{c==="tout"?"🌐 Tous":`🏷️ ${c}`}</button>)}
      </div>

      {filtered.length===0?<Empty icon="👥" title="Aucun client" sub="Les clients s'ajoutent automatiquement à chaque livraison confirmée"/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {filtered.map((c,i)=>(
          <div key={c.id} className="card fadeIn" style={{padding:16,animation:`fadeIn .3s ease ${i*30}ms both`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{c.nom}</div>
                <div style={{fontSize:12,color:"#9AA8C4"}}>📞 {c.phone}</div>
              </div>
              <button onClick={()=>onDel(c.id)} style={{width:28,height:28,borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#9AA8C4",cursor:"pointer",fontSize:12}}>🗑</button>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
              {(c.categories||"").split("|").filter(Boolean).map(cat=><span key={cat} style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>🏷️ {cat}</span>)}
            </div>
            <div style={{display:"flex",gap:12,marginBottom:12,fontSize:12,color:"#5B6B8C"}}>
              <span>🛍️ {c.nb_commandes} cmd</span>
              <span>💰 {fmt(c.total_depense)} F</span>
            </div>
            <button onClick={()=>envoyerPub(c)} className="btn" style={{width:"100%",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",padding:"9px"}}>📢 Envoyer la pub</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

/* ════════ BOUTIQUES ════════ */
function BoutiquesTab({boutiques,onAdd,onDel,onToggle}){
  return (
    <div className="fadeIn">
      <div style={{background:"#FBF4E6",border:"1px solid #F0DFB8",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#8A6D2F"}}>🏪 Ajoutez vos boutiques Shopify. Les commandes de toutes les boutiques actives s'affichent ensemble, chacune avec son nom.</div>
      <button onClick={onAdd} style={{width:"100%",padding:14,borderRadius:14,border:"2px dashed #F0DFB8",background:"#FFFBEB",color:"#C99A4B",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>➕ Ajouter une boutique Shopify</button>
      {boutiques.length===0?<Empty icon="🏪" title="Aucune boutique" sub="Ajoutez votre première boutique Shopify"/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {boutiques.map(b=>(
          <div key={b.id} className="card fadeIn" style={{padding:18,borderLeft:`4px solid ${b.couleur||"#E5B567"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:(b.couleur||"#E5B567")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏪</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{b.nom}</div>
                <div style={{fontSize:11,color:"#9AA8C4"}}>{b.domaine}</div>
              </div>
              <span style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:b.active?"#E3F7EE":"#F2F4F8",color:b.active?"#1E8E54":"#9AA8C4",fontWeight:600}}>{b.active?"● Active":"○ Inactive"}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>onToggle(b.id,!b.active)} style={{flex:1,padding:9,borderRadius:10,border:"1px solid #E8ECF4",background:"#fff",color:"#5B6B8C",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{b.active?"⏸️ Désactiver":"▶️ Activer"}</button>
              <button onClick={()=>onDel(b.id)} style={{width:38,padding:9,borderRadius:10,border:"1px solid #FDEAEA",background:"#FEF2F2",color:"#E5484D",cursor:"pointer",fontSize:14}}>🗑</button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

function AddBoutiqueSheet({newBoutique,setNewBoutique,onClose,onAdd}){
  const couleurs=["#E5B567","#3B82F6","#2BB673","#8B5CF6","#EC4899","#F2922C"];
  return <Sheet onClose={onClose} title="🏪 Ajouter une boutique Shopify">
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Nom de la boutique *"><input value={newBoutique.nom} onChange={e=>setNewBoutique(p=>({...p,nom:e.target.value}))} placeholder="Ex: Yah-ni Store" className="input"/></Field>
      <Field label="Domaine Shopify *"><input value={newBoutique.domaine} onChange={e=>setNewBoutique(p=>({...p,domaine:e.target.value}))} placeholder="yahni.myshopify.com" className="input"/></Field>
      <Field label="Token API Shopify *"><input value={newBoutique.token} onChange={e=>setNewBoutique(p=>({...p,token:e.target.value}))} placeholder="atkn_... ou shpat_..." className="input"/></Field>
      <Field label="Couleur d'identification">
        <div style={{display:"flex",gap:8}}>{couleurs.map(c=><button key={c} onClick={()=>setNewBoutique(p=>({...p,couleur:c}))} style={{width:36,height:36,borderRadius:10,border:newBoutique.couleur===c?"3px solid #0F1B3C":"1px solid #E8ECF4",background:c,cursor:"pointer"}}/>)}</div>
      </Field>
      <div style={{background:"#F7F8FB",borderRadius:10,padding:12,fontSize:11,color:"#5B6B8C",lineHeight:1.5}}>
        💡 Le token se trouve dans Shopify → Paramètres → Applications et canaux de vente → Développer des apps → votre app → Identifiants API → "Jeton d'accès Admin API"
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} className="btn btn-outline" style={{flex:1}}>Annuler</button>
        <button onClick={onAdd} disabled={!newBoutique.nom||!newBoutique.domaine||!newBoutique.token} className="btn btn-gold" style={{flex:2}}>✓ Ajouter la boutique</button>
      </div>
    </div>
  </Sheet>;
}


/* ════════ SETTINGS ════════ */
const PERM_LABELS = [
  {key:"commandes",label:"Commandes",icon:"📋"},
  {key:"relance",label:"Relancer",icon:"🔄"},
  {key:"clients",label:"Clients",icon:"👥"},
  {key:"bilan",label:"Bilan",icon:"📊"},
  {key:"depenses",label:"Dépenses",icon:"📉"},
  {key:"stock",label:"Stock",icon:"📦"},
  {key:"wishlist",label:"À commander",icon:"⭐"},
  {key:"boutiques",label:"Boutiques",icon:"🏪"},
  {key:"reportees",label:"Reportées",icon:"⏰"},
  {key:"voir_montants",label:"Voir les prix/montants",icon:"💰"},
  {key:"livreur_mode",label:"Interface livreur uniquement (remplace tout le reste)",icon:"🛵"},
];
const EMOJI_CHOICES = ["👤","👩‍💼","🧑‍💼","🛵","📦","💰","👨‍🔧","🧑‍🍳","📞","🛍️","🚚","🏪"];

function SettingsPanel({settings,msgTemplate,setMsgTemplate,onSave,onClose,role,isPatron,ROLES,reloadRoles,onResetDone,livreurs,reloadLivreurs}){
  const [livreurPhone,setLivreurPhone]=useState(settings.livreur_phone||"");
  const [shopifyStore,setShopifyStore]=useState(settings.shopify_store||"");
  const [shopifyToken,setShopifyToken]=useState("");
  const [waNumber,setWaNumber]=useState(settings.wa_number||"");
  const [waToken,setWaToken]=useState("");
  const [waProduits,setWaProduits]=useState(settings.wa_produits||"");
  const [oldPwd,setOldPwd]=useState(""); const [newPwd,setNewPwd]=useState(""); const [pwdMsg,setPwdMsg]=useState("");
  const [saved,setSaved]=useState(false);
  const [resetRole,setResetRole]=useState(null);
  const [resetPin,setResetPin]=useState("");
  const [teamMsg,setTeamMsg]=useState("");
  const [editRole,setEditRole]=useState(null); // slug en édition, ou "new"
  const [roleForm,setRoleForm]=useState({label:"",icon:"👤",color:"#8B5CF6",permissions:{}});

  async function save(){
    const u={livreur_phone:livreurPhone,msg_template:msgTemplate};
    if(isPatron){ if(shopifyStore)u.shopify_store=shopifyStore; if(shopifyToken)u.shopify_token=shopifyToken; if(waNumber)u.wa_number=waNumber; if(waToken)u.wa_token=waToken; if(waProduits)u.wa_produits=waProduits; }
    await onSave(u); setSaved(true); setTimeout(()=>setSaved(false),2000);
  }
  async function changePwd(){
    if(newPwd.length<4)return setPwdMsg("Code numérique de 4 chiffres minimum");
    const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"change",role,password:oldPwd,newPassword:newPwd})});
    const d=await r.json();
    if(d.success){setPwdMsg("✅ Modifié !");setOldPwd("");setNewPwd("");}else setPwdMsg(d.error||"Erreur");
  }
  async function adminSetPin(pin){
    const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"admin_set",role:resetRole,requesterRole:"patron",newPassword:pin})});
    const d=await r.json();
    setTeamMsg(d.success?`✅ Nouveau code défini pour ${ROLES[resetRole]?.label||resetRole}`:d.error);
    setResetRole(null); setResetPin("");
    if(d.success) reloadRoles();
  }
  async function adminBlock(r0){
    if(!window.confirm(`Bloquer l'accès de ${ROLES[r0].label} ? Cette personne devra que vous réinitialisiez son code pour se reconnecter.`))return;
    const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"admin_block",role:r0,requesterRole:"patron"})});
    const d=await r.json();
    setTeamMsg(d.success?`🔒 Accès de ${ROLES[r0].label} bloqué`:d.error);
    if(d.success) reloadRoles();
  }
  async function adminUnblock(r0){
    const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"admin_unblock",role:r0,requesterRole:"patron"})});
    const d=await r.json();
    setTeamMsg(d.success?`✅ Accès de ${ROLES[r0].label} débloqué`:d.error);
    if(d.success) reloadRoles();
  }
  function openNewRole(){ setRoleForm({label:"",icon:"👤",color:"#8B5CF6",permissions:{}}); setEditRole("new"); }
  function openEditRole(slug){ const r0=ROLES[slug]; setRoleForm({label:r0.label,icon:r0.icon,color:r0.color,permissions:{...r0.permissions}}); setEditRole(slug); }
  async function saveRole(){
    if(!roleForm.label.trim())return setTeamMsg("Le nom du rôle est requis");
    if(editRole==="new"){
      const r=await fetch("/api/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",requesterRole:"patron",role:roleForm})});
      const d=await r.json();
      if(d.error){ setTeamMsg("❌ "+d.error); return; }
      setTeamMsg(`✅ Rôle "${roleForm.label}" créé — pense à lui définir un code d'accès`);
    } else {
      const r=await fetch("/api/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update",requesterRole:"patron",slug:editRole,updates:roleForm})});
      const d=await r.json();
      if(d.error){ setTeamMsg("❌ "+d.error); return; }
      setTeamMsg(`✅ Rôle "${roleForm.label}" mis à jour`);
    }
    setEditRole(null); reloadRoles();
  }
  async function deleteRole(slug){
    if(!window.confirm(`Supprimer définitivement le rôle "${ROLES[slug].label}" ? Cette action est irréversible.`))return;
    const r=await fetch("/api/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",requesterRole:"patron",slug})});
    const d=await r.json();
    if(d.error){ setTeamMsg("❌ "+d.error); return; }
    setTeamMsg(`🗑 Rôle supprimé`); reloadRoles();
  }
  const [resetMsg,setResetMsg]=useState("");
  const [lvForm,setLvForm]=useState(null); // null | {id?,nom,ville,phone,principal}
  const [lvMsg,setLvMsg]=useState("");
  async function saveLivreur(){
    if(!lvForm?.nom?.trim()){ setLvMsg("❌ Le nom du livreur est requis"); return; }
    const isEdit = !!lvForm.id;
    const r=await fetch("/api/livreurs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(isEdit?{action:"update",requesterRole:"patron",id:lvForm.id,livreur:lvForm}:{action:"add",requesterRole:"patron",livreur:lvForm})});
    const d=await r.json();
    if(d.error){ setLvMsg("❌ "+d.error); return; }
    setLvMsg(isEdit?`✅ ${lvForm.nom} mis à jour`:`✅ ${lvForm.nom} ajouté`);
    setLvForm(null);
    if(reloadLivreurs)reloadLivreurs();
  }
  async function deleteLivreur(lv){
    if(!window.confirm(`Retirer le livreur "${lv.nom}" de la liste ?`))return;
    const r=await fetch("/api/livreurs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",requesterRole:"patron",id:lv.id})});
    const d=await r.json();
    setLvMsg(d.success?`🗑 ${lv.nom} retiré`:"❌ "+(d.error||"Erreur"));
    if(d.success&&reloadLivreurs)reloadLivreurs();
  }
  function confirmDouble(label){
    if(!window.confirm(label))return false;
    const typed = window.prompt('⚠️ Dernière vérification : tapez RESET (en majuscules) pour confirmer');
    if(typed!=="RESET"){ setResetMsg("Réinitialisation annulée."); return false; }
    return true;
  }
  async function resetDepenses(){
    if(!confirmDouble("Réinitialiser TOUTES les dépenses ? Elles seront définitivement supprimées."))return;
    const r=await fetch("/api/depenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset_all",requesterRole:"patron"})});
    const d=await r.json();
    setResetMsg(d.success?"✅ Dépenses réinitialisées.":"❌ "+(d.error||"Erreur"));
    if(d.success&&onResetDone)onResetDone();
  }
  async function resetBilan(){
    if(!confirmDouble("Réinitialiser le BILAN, les statuts et la page du livreur ?\n\n• Le bilan repart à zéro\n• Les statuts (livré/problème/reporté/transféré) sont effacés\n• La page du livreur est vidée\n• Les commandes ajoutées manuellement sont supprimées\n\n⚠️ La liste des commandes Shopify reste (elles reviennent en statut « en attente »)."))return;
    const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset_all",requesterRole:"patron"})});
    const d=await r.json();
    setResetMsg(d.success?"✅ Bilan, statuts et page livreur réinitialisés.":"❌ "+(d.error||"Erreur"));
    if(d.success&&onResetDone)onResetDone();
  }
  async function resetTout(){
    if(!confirmDouble("TOUT RÉINITIALISER ? Dépenses + bilan + statuts + page livreur repartent à zéro. Seule la liste des commandes Shopify reste."))return;
    const r1=await fetch("/api/depenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset_all",requesterRole:"patron"})});
    const r2=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset_all",requesterRole:"patron"})});
    const d1=await r1.json(), d2=await r2.json();
    setResetMsg(d1.success&&d2.success?"✅ Tout a été réinitialisé. Nouveau départ !":"❌ "+(d1.error||d2.error||"Erreur"));
    if(onResetDone)onResetDone();
  }
  return (
    <div style={{position:"fixed",inset:0,background:"var(--bg)",zIndex:300,overflowY:"auto",animation:"fadeIn .2s ease"}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
          <button onClick={onClose} style={{width:38,height:38,borderRadius:10,border:"1px solid #E8ECF4",background:"#fff",cursor:"pointer",fontSize:18,color:"#5B6B8C"}}>←</button>
          <h1 style={{fontSize:21,fontWeight:700}}>⚙️ Paramètres</h1>
        </div>

        {isPatron&&<Card title="👥 Rôles & équipe">
          <p style={{fontSize:12,color:"#5B6B8C",marginBottom:12,lineHeight:1.5}}>Crée des rôles sur mesure (emoji, couleur, permissions à la carte), réinitialise un code d'accès, ou bloque quelqu'un avec qui tu ne travailles plus.</p>
          {teamMsg&&<p style={{fontSize:12,color:teamMsg.includes("❌")?"#C0392B":"#1E8E54",marginBottom:12}}>{teamMsg}</p>}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
            {Object.entries(ROLES).filter(([slug,r0])=>!r0.is_system).sort((a,b)=>(a[1].ordre||99)-(b[1].ordre||99)).map(([slug,r0])=>(
              <div key={slug} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:`1px solid ${r0.actif===false?"#F5C2C2":"#E8ECF4"}`,flexWrap:"wrap",opacity:r0.actif===false?0.7:1}}>
                <div style={{width:36,height:36,borderRadius:10,background:roleGrad(r0),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{r0.icon}</div>
                <div style={{flex:1,minWidth:100}}>
                  <div style={{fontWeight:700,fontSize:13}}>{r0.label}{r0.actif===false&&<span style={{color:"#C0392B",fontWeight:600}}> · bloqué</span>}</div>
                </div>
                <button onClick={()=>openEditRole(slug)} style={{padding:"7px 9px",borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#5B6B8C",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                <button onClick={()=>{setResetRole(slug);setResetPin("");}} style={{padding:"7px 10px",borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#2563EB",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🔄 Code</button>
                {r0.actif===false
                  ? <button onClick={()=>adminUnblock(slug)} style={{padding:"7px 10px",borderRadius:8,border:"1px solid #A8E6C9",background:"#E3F7EE",color:"#1E8E54",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🔓 Débloquer</button>
                  : <button onClick={()=>adminBlock(slug)} style={{padding:"7px 10px",borderRadius:8,border:"1px solid #F5C2C2",background:"#FDEAEA",color:"#C0392B",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🔒</button>}
                <button onClick={()=>deleteRole(slug)} style={{padding:"7px 9px",borderRadius:8,border:"1px solid #F5C2C2",background:"#fff",color:"#C0392B",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
              </div>
            ))}
          </div>
          <button onClick={openNewRole} style={{width:"100%",padding:12,borderRadius:12,border:"2px dashed #E0C8FF",background:"#F9F5FF",color:"#7C3AED",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>➕ Nouveau rôle</button>
        </Card>}

        {isPatron&&<Card title="🛵 Livreurs">
          <p style={{fontSize:12,color:"#5B6B8C",marginBottom:12,lineHeight:1.5}}>Ajoute tes livreurs (Abidjan, Bouaké, Yamoussoukro...). Le livreur <b>principal</b> est celui qui a l'application : les commandes transférées apparaissent sur sa page. Les autres reçoivent uniquement SMS/WhatsApp.</p>
          {lvMsg&&<p style={{fontSize:12,color:lvMsg.includes("❌")?"#C0392B":"#1E8E54",marginBottom:12,fontWeight:600}}>{lvMsg}</p>}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {(livreurs||[]).map(lv=>(
              <div key={lv.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid #E8ECF4",flexWrap:"wrap"}}>
                <span style={{fontSize:18}}>🛵</span>
                <div style={{flex:1,minWidth:120}}>
                  <div style={{fontWeight:700,fontSize:13}}>{lv.nom} {lv.principal&&<span style={{fontSize:10,padding:"1px 7px",borderRadius:20,background:"#EEF0FE",color:"#4F46E5",fontWeight:700}}>📲 Principal (app)</span>}</div>
                  <div style={{fontSize:11,color:"#9AA8C4"}}>{lv.ville||"—"} · {lv.phone||"pas de numéro"}</div>
                </div>
                <button onClick={()=>setLvForm({id:lv.id,nom:lv.nom,ville:lv.ville||"",phone:lv.phone||"",principal:!!lv.principal})} style={{padding:"7px 9px",borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#5B6B8C",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                <button onClick={()=>deleteLivreur(lv)} style={{padding:"7px 9px",borderRadius:8,border:"1px solid #F5C2C2",background:"#fff",color:"#C0392B",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
              </div>
            ))}
            {(livreurs||[]).length===0&&<p style={{fontSize:12,color:"#9AA8C4",textAlign:"center",padding:"8px 0"}}>Aucun livreur pour l'instant.</p>}
          </div>
          <button onClick={()=>setLvForm({nom:"",ville:"",phone:"",principal:false})} style={{width:"100%",padding:12,borderRadius:12,border:"2px dashed #C7D2FE",background:"#EEF0FE",color:"#4F46E5",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>➕ Ajouter un livreur</button>
        </Card>}

        {isPatron&&<Card title="🔗 Boutique Shopify">
          <Field label="Domaine"><input value={shopifyStore} onChange={e=>setShopifyStore(e.target.value)} placeholder="yahni.myshopify.com" className="input"/></Field>
          <div style={{height:10}}/>
          <Field label="Token API (vide = inchangé)"><input type="password" value={shopifyToken} onChange={e=>setShopifyToken(e.target.value)} placeholder="atkn_..." className="input"/></Field>
        </Card>}

        {isPatron&&<Card title="🤖 Agent WhatsApp IA" badge="Bientôt">
          <p style={{fontSize:12,color:"#5B6B8C",marginBottom:12,lineHeight:1.5}}>Préparez ici votre agent WhatsApp. Dès que vos accès Meta Business seront validés, collez vos clés et l'agent répondra automatiquement aux prospects.</p>
          <Field label="Numéro WhatsApp Business"><input value={waNumber} onChange={e=>setWaNumber(e.target.value)} placeholder="2250701234567" className="input"/></Field>
          <div style={{height:10}}/>
          <Field label="Clé API (BSP / Meta)"><input type="password" value={waToken} onChange={e=>setWaToken(e.target.value)} placeholder="Collez votre clé API ici" className="input"/></Field>
          <div style={{height:10}}/>
          <Field label="Description de vos produits (pour entraîner l'agent)"><textarea value={waProduits} onChange={e=>setWaProduits(e.target.value)} placeholder="Décrivez vos produits, prix, délais de livraison... L'agent utilisera ces infos pour répondre aux clients." className="input" style={{minHeight:100,resize:"vertical"}}/></Field>
        </Card>}

        <Card title="💬 Message WhatsApp automatique">
          <p style={{fontSize:12,color:"#5B6B8C",marginBottom:10}}>Variables : <code style={{background:"#FBF4E6",color:"#C99A4B",padding:"1px 4px",borderRadius:4}}>{"{nom}"}</code> <code style={{background:"#FBF4E6",color:"#C99A4B",padding:"1px 4px",borderRadius:4}}>{"{produit}"}</code> <code style={{background:"#FBF4E6",color:"#C99A4B",padding:"1px 4px",borderRadius:4}}>{"{prix}"}</code></p>
          <textarea value={msgTemplate} onChange={e=>setMsgTemplate(e.target.value)} className="input" style={{minHeight:130,resize:"vertical"}}/>
        </Card>

        <Card title="🔐 Changer mon code">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Ancien"><input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={oldPwd} onChange={e=>setOldPwd(e.target.value.replace(/\D/g,""))} placeholder="••••" className="input"/></Field>
            <Field label="Nouveau"><input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={newPwd} onChange={e=>setNewPwd(e.target.value.replace(/\D/g,""))} placeholder="••••" className="input"/></Field>
          </div>
          {pwdMsg&&<p style={{fontSize:12,color:pwdMsg.includes("✅")?"#1E8E54":"#C0392B",marginTop:8}}>{pwdMsg}</p>}
          <button onClick={changePwd} className="btn btn-outline" style={{marginTop:10}}>Changer le code</button>
        </Card>

        <NotifSetup role={role} isLivreur={!!ROLES[role]?.permissions?.livreur_mode}/>

        {isPatron&&<Card title="♻️ Réinitialisation" badge="Zone sensible">
          <p style={{fontSize:12,color:"#5B6B8C",marginBottom:12,lineHeight:1.5}}>Repartir à zéro à tout moment. Chaque action demande une double confirmation (il faudra taper RESET). La liste des commandes Shopify n'est jamais supprimée.</p>
          {resetMsg&&<p style={{fontSize:12,color:resetMsg.includes("❌")?"#C0392B":"#1E8E54",marginBottom:12,fontWeight:600}}>{resetMsg}</p>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={resetDepenses} style={{width:"100%",padding:"11px 12px",borderRadius:10,border:"1px solid #F5C2C2",background:"#fff",color:"#C0392B",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>📉 Réinitialiser les dépenses</button>
            <button onClick={resetBilan} style={{width:"100%",padding:"11px 12px",borderRadius:10,border:"1px solid #F5C2C2",background:"#fff",color:"#C0392B",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>📊 Réinitialiser bilan + statuts + page livreur</button>
            <button onClick={resetTout} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#E5484D",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑 TOUT réinitialiser (nouveau départ)</button>
          </div>
        </Card>}

        <button onClick={save} className="btn btn-gold" style={{width:"100%",padding:14,fontSize:15,marginTop:4}}>{saved?"✅ Enregistré !":"💾 Enregistrer"}</button>
      </div>

      {resetRole&&<Sheet onClose={()=>{setResetRole(null);setResetPin("");}} title={`🔄 Nouveau code · ${ROLES[resetRole]?.label||resetRole}`}>
        <p style={{fontSize:12,color:"#5B6B8C",marginBottom:16}}>Entrez le nouveau code à 4 chiffres, puis communiquez-le à la personne concernée.</p>
        <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:22}}>
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<resetPin.length?"#E5B567":"#E8ECF4",border:"1.5px solid #E8ECF4"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:260,margin:"0 auto"}}>
          {["1","2","3","4","5","6","7","8","9"].map(d=>(
            <button key={d} onClick={()=>{const v=resetPin.length>=4?d:resetPin+d; setResetPin(v); if(v.length===4) adminSetPin(v);}} style={{padding:"16px 0",borderRadius:12,border:"1px solid #E8ECF4",background:"#F7F8FB",fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>
          ))}
          <div/>
          <button onClick={()=>{const v=resetPin.length>=4?"0":resetPin+"0"; setResetPin(v); if(v.length===4) adminSetPin(v);}} style={{padding:"16px 0",borderRadius:12,border:"1px solid #E8ECF4",background:"#F7F8FB",fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>0</button>
          <button onClick={()=>setResetPin(resetPin.slice(0,-1))} style={{padding:"16px 0",borderRadius:12,border:"1px solid #E8ECF4",background:"#F7F8FB",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:"#C0392B"}}>⌫</button>
        </div>
      </Sheet>}

      {lvForm&&<Sheet onClose={()=>setLvForm(null)} title={lvForm.id?`✏️ Modifier · ${lvForm.nom||"livreur"}`:"➕ Nouveau livreur"}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Field label="Nom du livreur *"><input value={lvForm.nom} onChange={e=>setLvForm(p=>({...p,nom:e.target.value}))} placeholder="Ex: Livreur Bouaké" className="input"/></Field>
          <Field label="Ville"><input value={lvForm.ville} onChange={e=>setLvForm(p=>({...p,ville:e.target.value}))} placeholder="Ex: Bouaké" className="input"/></Field>
          <Field label="Numéro WhatsApp / SMS"><input value={lvForm.phone} onChange={e=>setLvForm(p=>({...p,phone:e.target.value}))} placeholder="2250701234567" className="input"/></Field>
          <p style={{fontSize:11,color:"#9AA8C4",marginTop:-8}}>Format international sans + (ex: 2250701234567)</p>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:10,border:"1px solid #E8ECF4",cursor:"pointer",fontSize:13}}>
            <input type="checkbox" checked={!!lvForm.principal} onChange={e=>setLvForm(p=>({...p,principal:e.target.checked}))}/>
            <span>📲 Livreur principal (c'est lui qui a l'application — un seul possible)</span>
          </label>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={()=>setLvForm(null)} className="btn btn-outline" style={{flex:1}}>Annuler</button>
            <button onClick={saveLivreur} className="btn btn-gold" style={{flex:2}}>✓ Enregistrer</button>
          </div>
        </div>
      </Sheet>}

      {editRole&&<Sheet onClose={()=>setEditRole(null)} title={editRole==="new"?"➕ Nouveau rôle":`✏️ Modifier · ${ROLES[editRole]?.label}`}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Field label="Nom du rôle *"><input value={roleForm.label} onChange={e=>setRoleForm(p=>({...p,label:e.target.value}))} placeholder="Ex: 2ème Assistante" className="input"/></Field>
          <Field label="Emoji">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {EMOJI_CHOICES.map(e0=>(
                <button key={e0} onClick={()=>setRoleForm(p=>({...p,icon:e0}))} style={{width:38,height:38,borderRadius:10,border:`1.5px solid ${roleForm.icon===e0?"#E5B567":"#E8ECF4"}`,background:roleForm.icon===e0?"#FBF4E6":"#fff",fontSize:18,cursor:"pointer"}}>{e0}</button>
              ))}
            </div>
          </Field>
          <Field label="Couleur">
            <input type="color" value={roleForm.color} onChange={e=>setRoleForm(p=>({...p,color:e.target.value}))} style={{width:60,height:38,borderRadius:8,border:"1px solid #E8ECF4",cursor:"pointer"}}/>
          </Field>
          <Field label="Permissions">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {PERM_LABELS.map(p0=>(
                <label key={p0.key} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:"1px solid #E8ECF4",cursor:"pointer",fontSize:13}}>
                  <input type="checkbox" checked={!!roleForm.permissions[p0.key]} onChange={e=>setRoleForm(p=>({...p,permissions:{...p.permissions,[p0.key]:e.target.checked}}))}/>
                  <span>{p0.icon} {p0.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={()=>setEditRole(null)} className="btn btn-outline" style={{flex:1}}>Annuler</button>
            <button onClick={saveRole} className="btn btn-gold" style={{flex:2}}>✓ Enregistrer</button>
          </div>
        </div>
      </Sheet>}
    </div>
  );
}
function Card({title,children,badge}){return <div className="card" style={{padding:20,marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><h3 style={{fontSize:15,fontWeight:700}}>{title}</h3>{badge&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>{badge}</span>}</div>{children}</div>;}
