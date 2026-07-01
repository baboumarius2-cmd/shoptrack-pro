import { useState, useEffect, useCallback } from "react";

/* ═══ CONSTANTES ═══ */
const COMMUNES = ["Cocody","Yopougon","Marcory","Plateau","Adjamé","Abobo","Treichville","Port-Bouët","Koumassi","Attécoubé","Bingerville","Anyama","Songon"];
const MOTIFS = ["Client injoignable","Adresse introuvable","Client absent","Commande annulée","Reporter à une date","Autre motif"];
const COMMUNE_COLORS = {Cocody:"#6366F1",Yopougon:"#8B5CF6",Marcory:"#EC4899",Plateau:"#E5B567",Adjamé:"#2BB673",Abobo:"#3B82F6",Treichville:"#E5484D","Port-Bouët":"#14B8A6",Koumassi:"#F2922C",Attécoubé:"#84CC16",Bingerville:"#6366F1",Anyama:"#3B82F6",Songon:"#2BB673"};

// Quartiers/lieux connus rattachés à leur commune d'Abidjan (permet de reconnaître
// "Angré", "Riviera", "Zone 4", etc. même si le client n'a pas écrit le nom exact de la commune)
const QUARTIERS_ABIDJAN = {
  "cocody":"Cocody","angre":"Cocody","angré":"Cocody","riviera":"Cocody","deux plateaux":"Cocody","ii plateaux":"Cocody",
  "2 plateaux":"Cocody","mermoz":"Cocody","faya":"Cocody","danga":"Cocody","blockhauss":"Cocody","cite des arts":"Cocody",
  "saint jean":"Cocody","m'badon":"Cocody","mbadon":"Cocody",
  "yopougon":"Yopougon","siporex":"Yopougon","sideci":"Yopougon","toits rouges":"Yopougon","niangon":"Yopougon",
  "selmer":"Yopougon","sicogi":"Yopougon","gesco":"Yopougon","banco":"Yopougon","wassakara":"Yopougon","koweit":"Yopougon",
  "abobo":"Abobo","abobo-baoule":"Abobo","abobo baoule":"Abobo","anonkoi":"Abobo","avocatier":"Abobo","sagbe":"Abobo",
  "dokui":"Abobo","anador":"Abobo","banco 2":"Abobo",
  "adjame":"Adjamé","williamsville":"Adjamé","bracodi":"Adjamé","liberte":"Adjamé","220 logements":"Adjamé",
  "attecoube":"Attécoubé","locodjro":"Attécoubé","boribana":"Attécoubé","santé":"Attécoubé","santé village":"Attécoubé",
  "treichville":"Treichville","biafra":"Treichville","arras":"Treichville","zone 3":"Treichville",
  "marcory":"Marcory","zone 4":"Marcory","biétry":"Marcory","bietry":"Marcory","remblais":"Marcory","anoumabo":"Marcory",
  "koumassi":"Koumassi","prodomo":"Koumassi","sicogi koumassi":"Koumassi","grand marché koumassi":"Koumassi",
  "port-bouet":"Port-Bouët","port bouet":"Port-Bouët","vridi":"Port-Bouët","gonzagueville":"Port-Bouët","aeroport":"Port-Bouët",
  "plateau":"Plateau","indenie":"Plateau","cite administrative":"Plateau",
  "bingerville":"Bingerville","adjahui":"Bingerville",
  "anyama":"Anyama",
  "songon":"Songon",
};

function normalize(s){
  return (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}

// Retrouve la commune officielle d'Abidjan à partir d'un texte libre (ville/quartier tapé par le client)
function detectCommune(raw){
  const n = normalize(raw);
  if(!n) return null;
  for(const c of COMMUNES){ if(normalize(c)===n) return c; }
  const keys = Object.keys(QUARTIERS_ABIDJAN).sort((a,b)=>b.length-a.length);
  for(const k of keys){ if(n.includes(k)) return QUARTIERS_ABIDJAN[k]; }
  for(const c of COMMUNES){ if(n.includes(normalize(c))) return c; }
  return null;
}

// Libellé propre à afficher (commune détectée sinon texte d'origine)
function displayCommune(c){
  if(!c||c==="Inconnu") return "Inconnu";
  return detectCommune(c) || c;
}
const CAT_DEP = [
  {id:"emballage",label:"Emballages",icon:"📦",color:"#E5B567"},
  {id:"transport",label:"Transport",icon:"🚗",color:"#3B82F6"},
  {id:"publicite",label:"Publicité",icon:"📱",color:"#8B5CF6"},
  {id:"achat",label:"Achat stock",icon:"🛒",color:"#2BB673"},
  {id:"salaire",label:"Salaire",icon:"👤",color:"#EC4899"},
  {id:"fret",label:"Fret/Douane",icon:"✈️",color:"#14B8A6"},
  {id:"autre",label:"Autre",icon:"🔧",color:"#9AA8C4"},
];
const ROLES = {
  patron:{label:"Patron",icon:"👑",sub:"Accès complet",grad:"linear-gradient(135deg,#E5B567,#C99A4B)",color:"#E5B567"},
  assistante:{label:"Assistante",icon:"👩‍💼",sub:"Commandes & livraisons",grad:"linear-gradient(135deg,#8B5CF6,#EC4899)",color:"#8B5CF6"},
  livreur:{label:"Livreur",icon:"🛵",sub:"Mes livraisons",grad:"linear-gradient(135deg,#2BB673,#14B8A6)",color:"#2BB673"},
};
const TODAY = new Date().toISOString().split("T")[0];

function getZone(c){
  if(!c||c==="Inconnu") return "autre";
  if(detectCommune(c)) return "abidjan";
  if(normalize(c).includes("abidjan")) return "abidjan";
  return "hors";
}
function badgeColor(c){
  if(!c||c==="Inconnu") return "#9AA8C4";
  const d = detectCommune(c);
  if(!d) return "#E5484D";
  return COMMUNE_COLORS[d]||"#6366F1";
}
function catDep(id){return CAT_DEP.find(c=>c.id===id)||CAT_DEP[6];}
function fmt(n){return (n||0).toLocaleString("fr-FR");}

/* ═══ UI ═══ */
function Spin({size=20,c="#E5B567"}){return <div style={{width:size,height:size,border:`2.5px solid ${c}30`,borderTop:`2.5px solid ${c}`,borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>;}
function Sheet({children,onClose,title}){
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <h3 style={{fontSize:17,fontWeight:700}}>{title}</h3>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:"1px solid #E8ECF4",background:"#fff",cursor:"pointer",fontSize:15,color:"#5B6B8C"}}>✕</button>
        </div>}
        {children}
      </div>
    </div>
  );
}
function Stat({label,value,icon,color,sub}){
  return (
    <div className="card fadeIn stat-card" style={{padding:16,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-6,right:-6,fontSize:42,opacity:0.05}}>{icon}</div>
      <div className="stat-label" style={{fontSize:11,color:"var(--text-soft,#5B6B8C)",fontWeight:600,textTransform:"uppercase",letterSpacing:".04em",marginBottom:6}}>{label}</div>
      <div className="stat-value" style={{fontSize:22,fontWeight:800,color:color||"var(--text,#0F1B3C)",letterSpacing:"-.5px"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"var(--text-mute,#9AA8C4)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

export { COMMUNES, MOTIFS, CAT_DEP, ROLES, TODAY, getZone, badgeColor, displayCommune, catDep, fmt, Spin, Sheet, Stat };
