import { useState, useEffect, useCallback } from "react";
import { COMMUNES, MOTIFS, CAT_DEP, ROLES, TODAY, getZone, badgeColor, displayCommune, catDep, fmt, Spin, Sheet, Stat } from "../lib/ui.jsx";

export default function App() {
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

  const isPatron = role === "patron";
  const isLivreur = role === "livreur";
  const isAssistante = role === "assistante";

  function toast(msg, type="success"){ setNotif({msg,type}); setTimeout(()=>setNotif(null),3000); }

  /* ─ AUTH ─ */
  async function doLogin(){
    if(!pwd.trim())return;
    setAuth(true); setErr("");
    try{
      const r = await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",role:loginRole,password:pwd})});
      const d = await r.json();
      if(d.success){ setRole(loginRole); setScreen("app"); setPwd(""); setTab(loginRole==="livreur"?"livraisons":"commandes"); }
      else if(d.error==="no_password") setScreen("setup");
      else setErr(d.error||"Mot de passe incorrect");
    }catch{ setErr("Erreur de connexion. Vérifiez votre internet."); }
    setAuth(false);
  }
  async function doSetup(){
    if(sPwd.length<4)return setSErr("Minimum 4 caractères");
    if(sPwd!==sPwd2)return setSErr("Les mots de passe ne correspondent pas");
    setAuth(true);
    try{
      const r = await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"setup",role:loginRole,newPassword:sPwd})});
      const d = await r.json();
      if(d.success){ setRole(loginRole); setScreen("app"); setSPwd(""); setSPwd2(""); setTab(loginRole==="livreur"?"livraisons":"commandes"); }
      else setSErr(d.error);
    }catch{ setSErr("Erreur. Réessayez."); }
    setAuth(false);
  }

  /* ─ DATA ─ */
  const loadOrders = useCallback(async(forDate)=>{
    setRefreshing(true);
    try{
      const d = forDate || TODAY;
      const [shopR, savedR] = await Promise.all([ fetch(`/api/shopify?date=${d}`), fetch("/api/orders") ]);
      const shop = await shopR.json();
      const saved = await savedR.json();
      const savedMap = {};
      (saved||[]).forEach(o=>{ savedMap[o.shopify_id]=o; });
      let merged = [];
      if(shop.orders){
        merged = shop.orders.map(o=>{
          const s = savedMap[o.shopifyId];
          return s ? {...o, statut:s.statut||"en_attente", motif:s.motif||"", reportDate:s.report_date||"", contacted:s.contacted||[], transferred:s.transferred||false, livreurStatut:s.livreur_statut||"en_attente", wasReported:s.was_reported||false} : o;
        });
      }
      const manuals = (saved||[]).filter(o=>o.is_manual).map(o=>({
        id:o.numero||o.shopify_id, shopifyId:o.shopify_id, numero:o.numero, client:o.client, phone:o.phone||"",
        produit:o.produit, produitId:o.produit_id||"", quantite:o.quantite||1, prix:o.prix||0,
        commune:o.commune||"Inconnu", adresse:o.adresse||o.commune, livraison:2000,
        statut:o.statut||"en_attente", date:o.date, heure:o.heure||"", contacted:o.contacted||[],
        transferred:o.transferred||false, livreurStatut:o.livreur_statut||"en_attente",
        note:o.note||"", motif:o.motif||"", reportDate:o.report_date||"", wasReported:o.was_reported||false, isManual:true,
        boutiqueNom:o.boutique_nom||"", boutiqueId:o.boutique_id||"",
      }));
      // Commandes reportées (Shopify) sauvegardées : les ré-injecter même si Shopify ne les renvoie pas pour cette date
      const mergedIds = new Set(merged.map(m=>m.shopifyId));
      const reportedSaved = (saved||[]).filter(o=>!o.is_manual && o.statut==="reportee" && !mergedIds.has(o.shopify_id)).map(o=>({
        id:o.numero||o.shopify_id, shopifyId:o.shopify_id, numero:o.numero, client:o.client, phone:o.phone||"",
        produit:o.produit, produitId:o.produit_id||"", quantite:o.quantite||1, prix:o.prix||0,
        commune:o.commune||"Inconnu", adresse:o.adresse||o.commune, livraison:2000,
        statut:"reportee", date:o.date, heure:o.heure||"", contacted:o.contacted||[],
        transferred:o.transferred||false, livreurStatut:o.livreur_statut||"en_attente",
        note:o.note||"", motif:o.motif||"", reportDate:o.report_date||"", wasReported:o.was_reported||false, isManual:false,
        boutiqueNom:o.boutique_nom||"", boutiqueId:o.boutique_id||"",
      }));
      setOrders([...merged, ...manuals, ...reportedSaved]);
    }catch(e){ console.error(e); }
    setRefreshing(false);
  },[]);

  const loadAll = useCallback(async()=>{
    setLoading(true);
    try{
      const [s,p,d,w,b,cl] = await Promise.all([ fetch("/api/settings"), fetch("/api/produits"), fetch("/api/depenses"), fetch("/api/wishlist"), fetch("/api/boutiques"), fetch("/api/clients") ]);
      const sj = await s.json(); setSettings(sj||{});
      if(sj?.msg_template) setMsgTemplate(sj.msg_template);
      if(sj?.theme) setTheme(sj.theme);
      setProduits(await p.json()||[]);
      setDepenses(await d.json()||[]);
      setWishlist(await w.json()||[]);
      setBoutiques(await b.json()||[]);
      setClients(await cl.json()||[]);
    }catch(e){ console.error(e); }
    setLoading(false);
  },[]);

  useEffect(()=>{ if(screen==="app"){ loadAll(); loadOrders(viewDate); } },[screen]);
  useEffect(()=>{ if(screen==="app"){ loadOrders(viewDate); } },[viewDate]);

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
  const livraisons = orders.filter(o=>o.transferred && o.date===TODAY);

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
    };
    await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update",shopifyId:o.shopifyId,updates:body})});
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

  async function doLivrer(o){
    await updateOrder(o,{statut:"livree",livreurStatut:"livre"});
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
    updateOrder(o,{ statut:isRep?"reportee":"non_livree", motif:motifSel, ...(isRep&&reportDate?{reportDate,wasReported:true}:{}) });
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
    const c=[...(o.contacted||[])]; if(!c.includes("appel"))c.push("appel"); updateOrder(o,{contacted:c});
  }
  function transfer(o){
    // Ouvre le choix SMS / WhatsApp
    setModal({type:"transfer", order:o});
  }
  function doTransfer(o, canal){
    const lp = (settings.livreur_phone||"").replace(/\D/g,"");
    updateOrder(o,{transferred:true});
    const msg=`🛵 Nouvelle livraison Yah-ni\n\n👤 ${o.client}\n📞 ${o.phone}\n📍 ${o.adresse||o.commune}\n📦 ${o.produit}${o.boutiqueNom?`\n🏪 ${o.boutiqueNom}`:""}\n\nMerci ✅`;
    if(lp){
      if(canal==="sms") window.open(`sms:+${lp}?body=${encodeURIComponent(msg)}`,"_blank");
      else window.open(`https://wa.me/${lp}?text=${encodeURIComponent(msg)}`,"_blank");
    } else {
      toast("⚠️ Ajoutez le numéro du livreur dans Paramètres","error");
    }
    setModal(null);
    toast(`📤 Transféré au livreur par ${canal==="sms"?"SMS":"WhatsApp"}`);
  }
  function livreurUpdate(o, statut){
    const map={en_route:"en_attente",arrive:"en_attente",livre:"livree"};
    updateOrder(o,{livreurStatut:statut, ...(statut==="livre"?{statut:"livree"}:{})});
    toast(statut==="livre"?"✅ Marqué livré":statut==="en_route"?"🚗 En route":"📍 Arrivé");
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
      livreurStatut:"en_attente", note:newOrder.note, motif:"", reportDate:"", wasReported:false, isManual:true };
    setOrders(p=>[order,...p]);
    await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add_manual",order:{
      shopify_id:id, numero:order.numero, client:order.client, phone:order.phone, produit:order.produit, produit_id:order.produitId,
      quantite:order.quantite, prix:order.prix, commune:order.commune, adresse:order.commune, statut:"en_attente",
      date:TODAY, heure:order.heure, contacted:[], transferred:false, livreur_statut:"en_attente", note:order.note, is_manual:true }})});
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
    await fetch("/api/depenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add",depense:{...newDep,montant:+newDep.montant}})});
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
  if(screen==="login" && !loginRole) return <LoginHome onPick={setLoginRole}/>;
  if(screen==="login" && loginRole) return <LoginPwd role={loginRole} pwd={pwd} setPwd={setPwd} err={err} setErr={setErr} auth={auth} onBack={()=>{setLoginRole(null);setPwd("");setErr("");}} onLogin={doLogin}/>;
  if(screen==="setup") return <SetupPwd role={loginRole} sPwd={sPwd} setSPwd={setSPwd} sPwd2={sPwd2} setSPwd2={setSPwd2} sErr={sErr} setSErr={setSErr} auth={auth} onSetup={doSetup}/>;

  /* ═══ NAV ═══ */
  const navItems = isPatron
    ? [{id:"commandes",icon:"📋",label:"Commandes"},{id:"relance",icon:"🔄",label:"Relancer"},{id:"clients",icon:"👥",label:"Clients"},{id:"bilan",icon:"📊",label:"Bilan"},{id:"depenses",icon:"📉",label:"Dépenses"},{id:"stock",icon:"📦",label:"Stock"},{id:"wishlist",icon:"⭐",label:"À commander"},{id:"boutiques",icon:"🏪",label:"Boutiques"},{id:"reportees",icon:"⏰",label:"Reportées"}]
    : isAssistante
    ? [{id:"commandes",icon:"📋",label:"Commandes"},{id:"relance",icon:"🔄",label:"Relancer"},{id:"stock",icon:"📦",label:"Stock"},{id:"reportees",icon:"⏰",label:"Reportées"}]
    : [{id:"livraisons",icon:"🛵",label:"Mes livraisons"}];

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
.theme-clair{--bg:#F7F8FB;--card:#fff;--text:#0F1B3C;--text-soft:#5B6B8C;--text-mute:#9AA8C4;--border:#E8ECF4;--input-bg:#fff;--topbar-bg:#fff;}
/* THÈME SOMBRE */
.theme-sombre{--bg:#0B1220;--card:#16213E;--text:#EAF0FF;--text-soft:#9FB0D0;--text-mute:#6B7B9C;--border:#243355;--input-bg:#1A2742;--topbar-bg:#111B30;}

.app-root{background:var(--bg);color:var(--text);}
.app-root .card{background:var(--card)!important;border-color:var(--border)!important;}
.app-root .topbar{background:var(--topbar-bg)!important;border-color:var(--border)!important;}
.app-root .input{background:var(--input-bg)!important;color:var(--text)!important;border-color:var(--border)!important;}

/* En mode sombre, adoucir les textes très foncés codés en dur */
.theme-sombre .order-card .order-client{color:var(--text)!important;}
.theme-sombre h1,.theme-sombre h2,.theme-sombre h3{color:var(--text);}

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
      {!isLivreur && <div className="desktop-sidebar"><Sidebar role={role} navItems={navItems} tab={tab} setTab={setTab} reportees={reportees} todayOrders={todayOrders} livrees={livrees} enAttente={enAttente} beneficeJour={beneficeJour} depJour={depJour} isPatron={isPatron} theme={theme} onSettings={()=>setShowSettings(true)} onLogout={()=>{setRole(null);setScreen("login");setLoginRole(null);}}/></div>}

      <div className="main-content" style={{marginLeft:isLivreur?0:240,flex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        {/* TOPBAR */}
        <div className="topbar" style={{borderBottom:"1px solid #E8ECF4",padding:"0 16px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,background:ROLES[role].grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}} className="mobile-topbar-btn">{ROLES[role].icon}</div>
            <div>
              <h1 className="topbar-title" style={{fontSize:17,fontWeight:700}}>{navItems.find(n=>n.id===tab)?.icon} {navItems.find(n=>n.id===tab)?.label}</h1>
              <p style={{fontSize:11,color:"var(--text-mute)"}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setTheme(t=>{const nt=t==="clair"?"sombre":"clair"; saveSettings({theme:nt}); return nt;})} style={{width:38,height:38,borderRadius:10,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",fontSize:16}}>{theme==="clair"?"🌙":"☀️"}</button>
            <button onClick={()=>{loadOrders(viewDate);toast("🔄 Actualisé");}} style={{width:38,height:38,borderRadius:10,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:refreshing?"#E5B567":"var(--text-soft)"}}>{refreshing?<Spin size={16}/>:"🔄"}</button>
            {isLivreur&&<button onClick={()=>{setRole(null);setScreen("login");setLoginRole(null);}} style={{padding:"8px 14px",borderRadius:10,border:"1px solid var(--border)",background:"var(--card)",cursor:"pointer",fontSize:13,color:"var(--text-soft)",fontWeight:600}}>🚪</button>}
            {(isPatron||isAssistante)&&tab==="commandes"&&<button onClick={()=>setShowAddOrder(true)} className="btn btn-gold" style={{padding:"9px 16px"}}>✍️ Ajouter</button>}
          </div>
        </div>

        <div className="content-pad" style={{flex:1,padding:20,maxWidth:1240,margin:"0 auto",width:"100%"}}>
          {/* ═══ COMMANDES ═══ */}
          {tab==="commandes" && (isPatron||isAssistante) && (
            <div className="fadeIn">
              <DateNav viewDate={viewDate} setViewDate={setViewDate}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
                <Stat label="Total du jour" value={todayOrders.length} icon="📦" color="#E5B567" sub={`${abidjan.length} Abidjan`}/>
                <Stat label="Livrées" value={livrees.length} icon="✅" color="#2BB673" sub={`${todayOrders.length?Math.round(livrees.length/todayOrders.length*100):0}%`}/>
                <Stat label="En attente" value={enAttente.length} icon="⏳" color="#F2922C"/>
                {isPatron&&<Stat label="Net du jour" value={fmt(beneficeJour-depJour)+" F"} icon="💰" color="#8B5CF6"/>}
              </div>
              {refreshing&&orders.length===0?<Loader text="Chargement des commandes Shopify..."/>:(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18}}>
                  {[{t:"🏙️ Abidjan",items:abidjan,c:"#6366F1",bg:"#EEF0FE"},{t:"🛣️ Hors Abidjan",items:hors,c:"#E5B567",bg:"#FBF4E6"},{t:"❓ Inconnu",items:autre,c:"#9AA8C4",bg:"#F2F4F8"}].map(({t,items,c,bg})=>(
                    <div key={t}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"10px 14px",background:bg,borderRadius:10}}>
                        <span style={{fontWeight:700,fontSize:14,color:c}}>{t}</span>
                        <span style={{marginLeft:"auto",background:c,color:"#fff",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{items.length}</span>
                      </div>
                      {items.length===0?<div style={{textAlign:"center",padding:"24px",color:"#CBD5E8",fontSize:13}}>Aucune commande</div>:items.map((o,i)=><OrderCard key={o.shopifyId} o={o} i={i} isPatron={isPatron} isAssistante={isAssistante} onLivrer={()=>setModal({type:"livrer",order:o})} onMotif={()=>setModal({type:"motif",order:o})} onWA={()=>openWA(o)} onCall={()=>callCli(o)} onTransfer={()=>transfer(o)} viewDate={viewDate}/>)}
                    </div>
                  ))}
                </div>
              )}
              {!refreshing&&todayOrders.length===0&&<Empty icon="📭" title="Aucune commande aujourd'hui" sub="Les commandes Shopify apparaîtront ici"/>}
            </div>
          )}

          {/* ═══ LIVRAISONS (livreur) ═══ */}
          {tab==="livraisons" && isLivreur && (
            <div className="fadeIn">
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:22}}>
                <Stat label="À livrer" value={livraisons.filter(o=>o.livreurStatut!=="livre").length} icon="📦" color="#E5B567"/>
                <Stat label="Livrées" value={livraisons.filter(o=>o.livreurStatut==="livre").length} icon="✅" color="#2BB673"/>
                <Stat label="Total" value={livraisons.length} icon="🛵" color="#3B82F6"/>
              </div>
              {livraisons.length===0?<Empty icon="🛵" title="Aucune livraison" sub="Les commandes transférées apparaîtront ici"/>:
                livraisons.map((o,i)=><LivreurCard key={o.shopifyId} o={o} i={i} onUpdate={livreurUpdate} onCall={callCli}/>)}
            </div>
          )}

          {/* ═══ BILAN ═══ */}
          {tab==="bilan" && isPatron && <Bilan orders={orders} depenses={depenses} produits={produits} mode={bilanMode} setMode={setBilanMode} date={bilanDate} setDate={setBilanDate} setTab={setTab}/>}

          {/* ═══ DÉPENSES ═══ */}
          {tab==="depenses" && isPatron && <DepensesTab depenses={depenses} filter={depFilter} setFilter={setDepFilter} onAdd={()=>setShowAddDep(true)} onDel={delDepense}/>}

          {/* ═══ STOCK ═══ */}
          {tab==="stock" && (isPatron||isAssistante) && <StockTab produits={produits} isPatron={isPatron} loading={loading} onAdd={()=>setShowAddProd(true)} onDel={delProduit} onLink={(id)=>{setLinkTargetId(id);setShowShopifyPicker(true);}}/>}

          {/* ═══ WISHLIST ═══ */}
          {tab==="wishlist" && isPatron && <WishlistTab items={wishlist} onAdd={()=>setShowAddWish(true)} onDel={delWish}/>}

          {tab==="boutiques" && isPatron && <BoutiquesTab boutiques={boutiques} onAdd={()=>setShowAddBoutique(true)} onDel={delBoutique} onToggle={toggleBoutique}/>}

          {tab==="relance" && (isPatron||isAssistante) && <RelanceTab orders={orders} settings={settings} toast={toast}/>}

          {tab==="clients" && isPatron && <ClientsTab clients={clients} settings={settings} toast={toast} onDel={delClient}/>}

          {/* ═══ REPORTÉES ═══ */}
          {tab==="reportees" && (isPatron||isAssistante) && (
            <div className="fadeIn">
              <div style={{background:"#FBF4E6",border:"1px solid #F0DFB8",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#8A6D2F"}}>⏰ Ces commandes réapparaissent automatiquement le jour choisi</div>
              {reportees.length===0?<Empty icon="⏰" title="Aucune commande reportée"/>:reportees.map((o,i)=><OrderCard key={o.shopifyId} o={o} i={i} isPatron={isPatron} isAssistante={isAssistante} onLivrer={()=>setModal({type:"livrer",order:o})} onMotif={()=>setModal({type:"motif",order:o})} onWA={()=>openWA(o)} onCall={()=>callCli(o)} onTransfer={()=>transfer(o)} viewDate={viewDate}/>)}
            </div>
          )}
        </div>
      </div>

      {/* BARRE NAVIGATION MOBILE */}
      <div className="mobile-nav">
        {navItems.slice(0,4).map(it=>(
          <button key={it.id} onClick={()=>setTab(it.id)} className="mobile-nav-item" style={{background:tab===it.id?"rgba(229,181,103,0.15)":"none",color:tab===it.id?"#E5B567":"var(--text-mute)"}}>
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
            <button onClick={()=>{setRole(null);setScreen("login");setLoginRole(null);}} style={{padding:"18px 8px",borderRadius:14,border:"1.5px solid var(--border)",background:"var(--card)",color:"#E5484D",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
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
        <div style={{textAlign:"center",padding:"4px 0 18px"}}>
          <p style={{fontWeight:600,fontSize:15}}>{modal.order.client}</p>
          <p style={{color:"#5B6B8C",fontSize:13,marginTop:2}}>📍 {modal.order.adresse||modal.order.commune}</p>
          {!settings.livreur_phone&&<p style={{color:"#E5484D",fontSize:12,marginTop:8}}>⚠️ Aucun numéro livreur configuré (Paramètres)</p>}
        </div>
        <p style={{fontSize:13,color:"#5B6B8C",marginBottom:12,textAlign:"center"}}>Comment envoyer la commande au livreur ?</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>doTransfer(modal.order,"sms")} className="btn" style={{flex:1,padding:"14px",background:"#E8F1FE",color:"#2563EB",flexDirection:"column",gap:4,height:"auto"}}>
            <span style={{fontSize:24}}>📱</span> <span>Par SMS</span>
          </button>
          <button onClick={()=>doTransfer(modal.order,"whatsapp")} className="btn" style={{flex:1,padding:"14px",background:"#E3F7EE",color:"#1E8E54",flexDirection:"column",gap:4,height:"auto"}}>
            <span style={{fontSize:24}}>💬</span> <span>Par WhatsApp</span>
          </button>
        </div>
        <button onClick={()=>setModal(null)} className="btn btn-outline" style={{width:"100%",marginTop:10}}>Annuler</button>
      </Sheet>}

      {showAddOrder&&<AddOrderSheet newOrder={newOrder} setNewOrder={setNewOrder} produits={produits} onClose={()=>setShowAddOrder(false)} onAdd={addOrderManual}/>}
      {showAddProd&&<AddProdSheet newProd={newProd} setNewProd={setNewProd} onClose={()=>setShowAddProd(false)} onAdd={addProduit} onLinkShopify={()=>{setLinkTargetId(null);setShowShopifyPicker(true);}}/>}
      {showShopifyPicker&&<ShopifyProductPicker onClose={()=>{setShowShopifyPicker(false);setLinkTargetId(null);}} onSelect={relierProduitShopify}/>}
      {showAddDep&&<AddDepSheet newDep={newDep} setNewDep={setNewDep} onClose={()=>setShowAddDep(false)} onAdd={addDepense}/>}
      {showAddWish&&<AddWishSheet newWish={newWish} setNewWish={setNewWish} onClose={()=>setShowAddWish(false)} onAdd={addWish}/>}
      {showAddBoutique&&<AddBoutiqueSheet newBoutique={newBoutique} setNewBoutique={setNewBoutique} onClose={()=>setShowAddBoutique(false)} onAdd={addBoutique}/>}
      {showSettings&&<SettingsPanel settings={settings} msgTemplate={msgTemplate} setMsgTemplate={setMsgTemplate} onSave={saveSettings} onClose={()=>setShowSettings(false)} role={role} isPatron={isPatron}/>}
    </div>
  );
}

/* ════════ LOGIN COMPONENTS ════════ */
function LoginHome({onPick}){
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#0F1B3C 0%,#1A2B52 60%,#0F1B3C 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      <div style={{maxWidth:440,width:"100%",animation:"fadeIn .5s ease"}}>
        <div style={{textAlign:"center",marginBottom:44}}>
          <div style={{width:84,height:84,borderRadius:24,background:"linear-gradient(135deg,#F0C674,#C99A4B)",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,boxShadow:"0 0 50px rgba(229,181,103,0.4)",animation:"float 3s ease-in-out infinite"}}>🛍️</div>
          <h1 style={{fontSize:34,fontWeight:800,color:"#fff",letterSpacing:"-1px"}}>Yah-ni Store</h1>
          <p style={{color:"#9AA8C4",fontSize:14,marginTop:4}}>Gestion intelligente · yahni.store</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {Object.entries(ROLES).map(([k,r])=>(
            <button key={k} onClick={()=>onPick(k)} style={{padding:"20px 22px",borderRadius:18,border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",background:"rgba(255,255,255,0.05)",color:"#fff",display:"flex",alignItems:"center",gap:16,textAlign:"left",position:"relative",overflow:"hidden",transition:"all .2s",backdropFilter:"blur(10px)"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateX(4px)";e.currentTarget.style.borderColor="rgba(229,181,103,0.4)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateX(0)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>
              <div style={{position:"absolute",inset:0,background:r.grad,opacity:0.1}}/>
              <div style={{width:50,height:50,borderRadius:14,background:r.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0,zIndex:1}}>{r.icon}</div>
              <div style={{zIndex:1}}>
                <div style={{fontSize:17,fontWeight:700}}>{r.label}</div>
                <div style={{fontSize:12,color:"#9AA8C4",marginTop:2}}>{r.sub}</div>
              </div>
              <div style={{marginLeft:"auto",color:"#9AA8C4",fontSize:20,zIndex:1}}>→</div>
            </button>
          ))}
        </div>
        <p style={{textAlign:"center",color:"#4A5878",fontSize:12,marginTop:32}}>© 2026 Yah-ni Store</p>
      </div>
    </div>
  );
}

function LoginPwd({role,pwd,setPwd,err,setErr,auth,onBack,onLogin}){
  const r = ROLES[role];
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#0F1B3C,#1A2B52)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{maxWidth:370,width:"100%",animation:"fadeIn .4s ease"}}>
        <button onClick={onBack} style={{color:"#9AA8C4",background:"none",border:"none",cursor:"pointer",fontSize:13,marginBottom:28,fontFamily:"inherit"}}>← Retour</button>
        <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",borderRadius:22,padding:32,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{textAlign:"center",marginBottom:26}}>
            <div style={{width:56,height:56,borderRadius:16,background:r.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>{r.icon}</div>
            <h2 style={{fontSize:21,fontWeight:700,color:"#fff"}}>Espace {r.label}</h2>
            <p style={{color:"#9AA8C4",fontSize:13,marginTop:3}}>Entrez votre mot de passe</p>
          </div>
          <input type="password" value={pwd} onChange={e=>{setPwd(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&onLogin()} placeholder="••••••••" autoFocus
            style={{width:"100%",padding:"14px 16px",borderRadius:12,border:`1.5px solid ${err?"#E5484D":"rgba(255,255,255,0.1)"}`,background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:18,textAlign:"center",letterSpacing:"4px",outline:"none",marginBottom:12,fontFamily:"inherit"}}/>
          {err&&<p style={{color:"#FF8A8A",fontSize:12,textAlign:"center",marginBottom:12}}>{err}</p>}
          <button onClick={onLogin} disabled={auth||!pwd} style={{width:"100%",padding:14,borderRadius:12,border:"none",cursor:pwd&&!auth?"pointer":"default",background:pwd&&!auth?r.grad:"rgba(255,255,255,0.06)",color:pwd&&!auth?"#0F1B3C":"#4A5878",fontSize:15,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {auth?<><Spin size={18} c="#0F1B3C"/> Connexion...</>:"Se connecter →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupPwd({role,sPwd,setSPwd,sPwd2,setSPwd2,sErr,setSErr,auth,onSetup}){
  const r = ROLES[role];
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#0F1B3C,#1A2B52)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{maxWidth:370,width:"100%",animation:"fadeIn .4s ease"}}>
        <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",borderRadius:22,padding:32,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{textAlign:"center",marginBottom:26}}>
            <div style={{fontSize:42,marginBottom:12}}>🔐</div>
            <h2 style={{fontSize:20,fontWeight:700,color:"#fff"}}>Créer votre mot de passe</h2>
            <p style={{color:"#9AA8C4",fontSize:13,marginTop:3}}>Première connexion · {r.label}</p>
          </div>
          {[{v:sPwd,s:setSPwd,p:"Mot de passe (min. 4)"},{v:sPwd2,s:setSPwd2,p:"Confirmer"}].map((x,i)=>(
            <input key={i} type="password" value={x.v} onChange={e=>{x.s(e.target.value);setSErr("");}} onKeyDown={e=>e.key==="Enter"&&i===1&&onSetup()} placeholder={x.p}
              style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${sErr?"#E5484D":"rgba(255,255,255,0.1)"}`,background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:14,outline:"none",marginBottom:10,fontFamily:"inherit"}}/>
          ))}
          {sErr&&<p style={{color:"#FF8A8A",fontSize:12,marginBottom:10}}>{sErr}</p>}
          <button onClick={onSetup} disabled={auth} style={{width:"100%",padding:14,borderRadius:12,border:"none",cursor:"pointer",background:r.grad,color:"#0F1B3C",fontSize:15,fontWeight:700,fontFamily:"inherit",marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {auth?<><Spin size={18} c="#0F1B3C"/> Création...</>:"Créer le mot de passe ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════ SIDEBAR ════════ */
function Sidebar({role,navItems,tab,setTab,reportees,todayOrders,livrees,enAttente,beneficeJour,depJour,isPatron,onSettings,onLogout}){
  const r = ROLES[role];
  return (
    <div style={{width:240,background:"#0F1B3C",minHeight:"100vh",position:"fixed",left:0,top:0,bottom:0,display:"flex",flexDirection:"column",zIndex:100}}>
      <div style={{padding:"22px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#F0C674,#C99A4B)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🛍️</div>
          <div>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>Yah-ni Store</div>
            <div style={{color:"#E5B567",fontSize:11,fontWeight:600}}>{r.icon} {r.label}</div>
          </div>
        </div>
      </div>
      {isPatron&&<div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{v:todayOrders.length,l:"Commandes",c:"#E5B567"},{v:livrees.length,l:"Livrées",c:"#2BB673"},{v:fmt(beneficeJour-depJour)+"F",l:"Net jour",c:"#8B5CF6"},{v:enAttente.length,l:"Attente",c:"#F2922C"}].map(({v,l,c})=>(
            <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:15,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:10,color:"#6B7B9C",marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>
      </div>}
      <nav style={{flex:1,padding:12}}>
        {navItems.map(it=>(
          <button key={it.id} onClick={()=>setTab(it.id)} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"none",cursor:"pointer",background:tab===it.id?"rgba(229,181,103,0.15)":"transparent",color:tab===it.id?"#E5B567":"#9AA8C4",display:"flex",alignItems:"center",gap:11,fontSize:14,fontWeight:tab===it.id?600:500,marginBottom:2,fontFamily:"inherit",textAlign:"left",transition:"all .15s"}}>
            <span style={{fontSize:17,width:22,textAlign:"center"}}>{it.icon}</span>{it.label}
            {it.id==="reportees"&&reportees.length>0&&<span style={{marginLeft:"auto",background:"#E5484D",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{reportees.length}</span>}
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

function OrderCard({o,i,isPatron,isAssistante,onLivrer,onMotif,onWA,onCall,onTransfer,viewDate}){
  const isDue = o.statut==="reportee" && o.reportDate===viewDate; // reportée arrivée à échéance → ré-actionnable
  const isLivree=o.statut==="livree",isBad=o.statut==="non_livree",isRep=o.statut==="reportee" && !isDue;
  const actionnable = o.statut==="en_attente" || isDue;
  const c=o.contacted||[], bc=badgeColor(o.commune);
  const seePrix = isPatron||isAssistante;
  return (
    <div className="card order-card" style={{padding:"14px 16px",marginBottom:10,animation:`fadeIn .3s ease ${i*40}ms both`,borderLeft:`3px solid ${isLivree?"#2BB673":isBad?"#E5484D":isRep?"#E5B567":"#E8ECF4"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"#9AA8C4",fontFamily:"monospace"}}>{o.numero||o.id}</span>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:bc+"18",color:bc,fontWeight:600}}>{displayCommune(o.commune)}</span>
            {o.boutiqueNom&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:(o.boutiqueCouleur||"#E5B567")+"22",color:o.boutiqueCouleur||"#C99A4B",fontWeight:700}}>🏪 {o.boutiqueNom}</span>}
            {o.isManual&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>✍️</span>}
            {o.wasReported&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#FBF4E6",color:"#C99A4B",fontWeight:600}}>↩️ Reporté</span>}
          </div>
          <div className="order-client" style={{fontWeight:700,fontSize:15,marginBottom:2,color:"var(--text)"}}>{o.client}</div>
          <div className="order-produit" style={{color:"var(--text-soft)",fontSize:12,marginBottom:4}}>📦 {o.produit}</div>
          <div style={{fontSize:12,color:"#5B6B8C",marginBottom:seePrix?4:0}}>📍 {o.adresse||o.commune}</div>
          {seePrix&&<div style={{fontSize:12,color:"#2BB673",fontWeight:600}}>{fmt(o.prix)} F {isPatron&&<span style={{color:"#9AA8C4",fontWeight:400}}>· net {fmt((o.prix||0)-o.livraison)} F</span>}</div>}
          {o.note&&<div style={{fontSize:11,color:"#9AA8C4",marginTop:2}}>📝 {o.note}</div>}
          {o.motif&&<div style={{fontSize:11,color:"#5B6B8C",marginTop:2}}>Motif: {o.motif}</div>}
          {o.reportDate&&<div style={{fontSize:11,color:"#C99A4B",marginTop:2,fontWeight:500}}>📅 Reporté au {o.reportDate}</div>}
        </div>
        <div style={{textAlign:"right",marginLeft:8}}>
          <div style={{fontSize:10,color:"#9AA8C4",marginBottom:6}}>🕐 {o.heure}</div>
          {isLivree&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:"#E3F7EE",color:"#1E8E54",fontWeight:600}}>✓ Livré</span>}
          {isBad&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:"#FDEAEA",color:"#C0392B",fontWeight:600}}>✗ Échoué</span>}
          {isRep&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:"#FBF4E6",color:"#C99A4B",fontWeight:600}}>⏰ Reporté</span>}
          {isDue&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:"#FEF3C7",color:"#B45309",fontWeight:700}}>↩️ Reporté à aujourd'hui</span>}
        </div>
      </div>
      {(c.length>0||o.transferred)&&<div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
        {c.includes("whatsapp")&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#E3F7EE",color:"#1E8E54",fontWeight:600}}>💬 WA</span>}
        {c.includes("appel")&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>📞 Appelé</span>}
        {o.transferred&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#FBF4E6",color:"#C99A4B",fontWeight:600}}>📤 Transféré</span>}
      </div>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:actionnable?10:0}}>
        <button onClick={onCall} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#7C3AED",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📞</button>
        <button onClick={onWA} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#1E8E54",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>💬 WA</button>
        {!o.transferred?<button onClick={onTransfer} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #F0DFB8",background:"#FBF4E6",color:"#C99A4B",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📤 Livreur</button>:<span style={{fontSize:11,color:"#C99A4B",fontWeight:500,padding:"6px 2px"}}>✓ Transféré</span>}
      </div>
      {actionnable&&<div style={{display:"flex",gap:8,paddingTop:10,borderTop:"1px solid #F2F4F8"}}>
        <button onClick={onLivrer} style={{flex:1,padding:9,borderRadius:10,border:"none",cursor:"pointer",background:"#E3F7EE",color:"#1E8E54",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>✓ Livré</button>
        <button onClick={onMotif} style={{flex:1,padding:9,borderRadius:10,border:"none",cursor:"pointer",background:"#FDEAEA",color:"#C0392B",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>✗ Problème</button>
      </div>}
    </div>
  );
}

function LivreurCard({o,i,onUpdate,onCall}){
  const st=o.livreurStatut||"en_attente";
  const steps=[{id:"en_route",l:"En route",icon:"🚗"},{id:"arrive",l:"Arrivé",icon:"📍"},{id:"livre",l:"Livré",icon:"✅"}];
  const stepIdx=st==="livre"?2:st==="arrive"?1:st==="en_route"?0:-1;
  return (
    <div className="card" style={{padding:18,marginBottom:14,animation:`fadeIn .3s ease ${i*50}ms both`,borderLeft:`4px solid ${st==="livre"?"#2BB673":"#E5B567"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700}}>{o.client}</div>
          <div style={{fontSize:13,color:"#5B6B8C",marginTop:2}}>📦 {o.produit}</div>
        </div>
        {st==="livre"&&<span style={{fontSize:12,padding:"4px 10px",borderRadius:20,background:"#E3F7EE",color:"#1E8E54",fontWeight:700,height:"fit-content"}}>✓ Livré</span>}
      </div>
      <div style={{background:"#F7F8FB",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:16}}>📍</span><span style={{fontSize:14,fontWeight:600}}>{o.adresse||o.commune}</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>📞</span><span style={{fontSize:14,color:"#5B6B8C"}}>{o.phone}</span></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>onCall(o)} style={{flex:1,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#E8F1FE",color:"#2563EB",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>📞 Appeler</button>
        <button onClick={()=>window.open(`https://maps.google.com/?q=${encodeURIComponent(o.adresse||o.commune)}`,"_blank")} style={{flex:1,padding:12,borderRadius:12,border:"none",cursor:"pointer",background:"#F3E8FF",color:"#7C3AED",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>🗺️ Itinéraire</button>
      </div>
      <div style={{display:"flex",gap:6}}>
        {steps.map((s,idx)=>(
          <button key={s.id} onClick={()=>onUpdate(o,s.id)} style={{flex:1,padding:"10px 6px",borderRadius:10,border:"none",cursor:"pointer",background:idx<=stepIdx?(s.id==="livre"?"#2BB673":"#E5B567"):"#F2F4F8",color:idx<=stepIdx?"#fff":"#9AA8C4",fontSize:12,fontWeight:700,fontFamily:"inherit",transition:"all .15s"}}>
            {s.icon} {s.l}
          </button>
        ))}
      </div>
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
            <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}>
              <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:c.color+"18",color:c.color,fontWeight:600}}>{c.icon} {c.label}</span>
              <span style={{fontSize:11,color:"#9AA8C4"}}>{d.date}</span>
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
function StockTab({produits,isPatron,loading,onAdd,onDel,onLink}){
  return (
    <div className="fadeIn">
      {!isPatron&&<div style={{background:"#E8F1FE",border:"1px solid #BcDcFc",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#2563EB"}}>👁️ Vue quantités — montants réservés au patron</div>}
      {isPatron&&<button onClick={onAdd} style={{width:"100%",padding:14,borderRadius:14,border:"2px dashed #F0DFB8",background:"#FBF4E6",color:"#C99A4B",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:18,fontFamily:"inherit"}}>➕ Ajouter un produit</button>}
      {loading?<Loader text="Chargement..."/>:produits.length===0?<Empty icon="📦" title="Aucun produit" sub={isPatron?"Ajoutez votre premier produit":"Aucun produit en stock"}/>:
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
                {isPatron&&<button onClick={()=>onDel(p.id)} style={{width:28,height:28,borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",color:"#9AA8C4",cursor:"pointer",fontSize:12}}>🗑</button>}
              </div>
              {isPatron&&(p.shopify_id
                ? <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,fontSize:11,color:"#1E8E54",background:"#E3F7EE",borderRadius:8,padding:"6px 10px"}}>🔗 Lié à Shopify <button onClick={()=>onLink(p.id)} style={{marginLeft:"auto",border:"none",background:"none",color:"#1E8E54",fontWeight:700,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Changer</button></div>
                : <button onClick={()=>onLink(p.id)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",marginBottom:12,fontSize:11,color:"#C0392B",background:"#FDEAEA",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>⚠️ Non lié à Shopify — le stock ne se décrémentera pas automatiquement. Lier maintenant</button>
              )}
              {isPatron&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
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
function SettingsPanel({settings,msgTemplate,setMsgTemplate,onSave,onClose,role,isPatron}){
  const [livreurPhone,setLivreurPhone]=useState(settings.livreur_phone||"");
  const [shopifyStore,setShopifyStore]=useState(settings.shopify_store||"");
  const [shopifyToken,setShopifyToken]=useState("");
  const [waNumber,setWaNumber]=useState(settings.wa_number||"");
  const [waToken,setWaToken]=useState("");
  const [waProduits,setWaProduits]=useState(settings.wa_produits||"");
  const [oldPwd,setOldPwd]=useState(""); const [newPwd,setNewPwd]=useState(""); const [pwdMsg,setPwdMsg]=useState("");
  const [saved,setSaved]=useState(false);

  async function save(){
    const u={livreur_phone:livreurPhone,msg_template:msgTemplate};
    if(isPatron){ if(shopifyStore)u.shopify_store=shopifyStore; if(shopifyToken)u.shopify_token=shopifyToken; if(waNumber)u.wa_number=waNumber; if(waToken)u.wa_token=waToken; if(waProduits)u.wa_produits=waProduits; }
    await onSave(u); setSaved(true); setTimeout(()=>setSaved(false),2000);
  }
  async function changePwd(){
    if(!newPwd||newPwd.length<4)return setPwdMsg("Minimum 4 caractères");
    const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"change",role,password:oldPwd,newPassword:newPwd})});
    const d=await r.json();
    if(d.success){setPwdMsg("✅ Modifié !");setOldPwd("");setNewPwd("");}else setPwdMsg(d.error||"Erreur");
  }
  return (
    <div style={{position:"fixed",inset:0,background:"var(--bg)",zIndex:300,overflowY:"auto",animation:"fadeIn .2s ease"}}>
      <div style={{maxWidth:680,margin:"0 auto",padding:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
          <button onClick={onClose} style={{width:38,height:38,borderRadius:10,border:"1px solid #E8ECF4",background:"#fff",cursor:"pointer",fontSize:18,color:"#5B6B8C"}}>←</button>
          <h1 style={{fontSize:21,fontWeight:700}}>⚙️ Paramètres</h1>
        </div>

        <Card title="🛵 Livreur">
          <Field label="Numéro WhatsApp du livreur"><input value={livreurPhone} onChange={e=>setLivreurPhone(e.target.value)} placeholder="2250701234567" className="input"/></Field>
          <p style={{fontSize:11,color:"#9AA8C4",marginTop:5}}>Format international sans + (ex: 2250701234567)</p>
        </Card>

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

        <Card title="🔐 Changer mon mot de passe">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Ancien"><input type="password" value={oldPwd} onChange={e=>setOldPwd(e.target.value)} placeholder="••••" className="input"/></Field>
            <Field label="Nouveau"><input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="••••" className="input"/></Field>
          </div>
          {pwdMsg&&<p style={{fontSize:12,color:pwdMsg.includes("✅")?"#1E8E54":"#C0392B",marginTop:8}}>{pwdMsg}</p>}
          <button onClick={changePwd} className="btn btn-outline" style={{marginTop:10}}>Changer le mot de passe</button>
        </Card>

        <button onClick={save} className="btn btn-gold" style={{width:"100%",padding:14,fontSize:15,marginTop:4}}>{saved?"✅ Enregistré !":"💾 Enregistrer"}</button>
      </div>
    </div>
  );
}
function Card({title,children,badge}){return <div className="card" style={{padding:20,marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><h3 style={{fontSize:15,fontWeight:700}}>{title}</h3>{badge&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"#F3E8FF",color:"#7C3AED",fontWeight:600}}>{badge}</span>}</div>{children}</div>;}
