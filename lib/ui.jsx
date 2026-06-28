import { useState, useEffect, useCallback } from "react";

/* ═══ CONSTANTES ═══ */
const COMMUNES = ["Cocody","Yopougon","Marcory","Plateau","Adjamé","Abobo","Treichville","Port-Bouët","Koumassi","Attécoubé","Bingerville","Anyama"];
const MOTIFS = ["Client injoignable","Adresse introuvable","Client absent","Commande annulée","Reporter à une date","Autre motif"];
const COMMUNE_COLORS = {Cocody:"#6366F1",Yopougon:"#8B5CF6",Marcory:"#EC4899",Plateau:"#E5B567",Adjamé:"#2BB673",Abobo:"#3B82F6",Treichville:"#E5484D","Port-Bouët":"#14B8A6",Koumassi:"#F2922C",Attécoubé:"#84CC16"};
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

function getZone(c){return !c||c==="Inconnu"?"autre":COMMUNES.includes(c)?"abidjan":"hors";}
function badgeColor(c){if(!c||c==="Inconnu")return"#9AA8C4";if(!COMMUNES.includes(c))return"#E5484D";return COMMUNE_COLORS[c]||"#6366F1";}
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
    <div className="card fadeIn" style={{padding:16,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-6,right:-6,fontSize:42,opacity:0.05}}>{icon}</div>
      <div style={{fontSize:11,color:"#5B6B8C",fontWeight:600,textTransform:"uppercase",letterSpacing:".04em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:color||"#0F1B3C",letterSpacing:"-.5px"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"#9AA8C4",marginTop:3}}>{sub}</div>}
    </div>
  );
}

export { COMMUNES, MOTIFS, CAT_DEP, ROLES, TODAY, getZone, badgeColor, catDep, fmt, Spin, Sheet, Stat };
