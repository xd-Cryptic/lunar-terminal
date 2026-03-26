import{u as O,r as l,j as e,H as p,b as Y,d as U,e as B}from"./index-DeIgpUXC.js";const F=["general","technology","finance","crypto","energy","healthcare"],P=[{value:"technical",label:"Technical Analysis"},{value:"fundamental",label:"Fundamental Analysis"},{value:"sentiment",label:"Sentiment Analysis"},{value:"macro",label:"Macro Overview"},{value:"risk",label:"Risk Assessment"}],z=["SPY","VIX","DXY","US10Y","GOLD","OIL","BTC"];function C(a){if(!a)return"var(--hud-text-dim)";const n=a.toLowerCase();return n==="bullish"||n==="positive"?"var(--hud-green)":n==="bearish"||n==="negative"?"var(--hud-red)":"var(--hud-text-dim)"}function R(a){return a.sentiment?a.sentiment:{label:"neutral",score:0,reasoning:""}}function H({article:a}){var r;const n=R(a),t=C(n.label),i=typeof n.score=="number"?n.score:0;return e.jsxs("div",{className:"news-card",onClick:()=>a.url&&window.open(a.url,"_blank"),children:[e.jsxs("div",{className:"news-card__meta",children:[e.jsx("span",{className:"news-card__sentiment",style:{background:t}}),e.jsx("span",{children:a.source||"Unknown"}),e.jsx("span",{children:((r=a.published)==null?void 0:r.split("T")[0])||""}),e.jsxs("span",{className:"news-ai-screen__sentiment-tag",style:{background:`${t}18`,color:t,border:`1px solid ${t}44`},children:[(n.label||"NEUTRAL").toUpperCase()," ",(i*100).toFixed(0),"%"]})]}),e.jsx("div",{className:"news-card__headline",children:a.title}),n.reasoning&&e.jsx("div",{className:"news-card__ai-summary",children:e.jsx("span",{style:{color:t},children:n.reasoning})}),e.jsxs("div",{className:"news-ai-screen__confidence",children:[e.jsx("div",{className:"news-ai-screen__confidence-track",children:e.jsx("div",{className:"news-ai-screen__confidence-fill",style:{width:`${i*100}%`,background:t}})}),e.jsxs("span",{className:"news-ai-screen__confidence-label",children:[(i*100).toFixed(0),"%"]})]}),e.jsx("a",{href:a.url,target:"_blank",rel:"noopener noreferrer",className:"news-ai-screen__source-link",onClick:o=>o.stopPropagation(),children:"VIEW SOURCE →"})]})}function V({articles:a}){const n={bullish:0,bearish:0,neutral:0};let t=0;a.forEach(m=>{const h=R(m),d=(h.label||"neutral").toLowerCase();d==="bullish"||d==="positive"?n.bullish++:d==="bearish"||d==="negative"?n.bearish++:n.neutral++,t+=typeof h.score=="number"?h.score:0});const i=a.length||1,r=t/i,o=r>.55?"BULLISH":r<.45?"BEARISH":"NEUTRAL",x=C(o);return e.jsxs("div",{className:"news-ai-screen__summary",children:[e.jsxs("div",{className:"news-ai-screen__summary-row",children:[e.jsx("span",{className:"hud-readout__label",children:"OVERALL"}),e.jsxs("span",{style:{color:x,fontWeight:700,fontSize:12,letterSpacing:2},children:[o," ",(r*100).toFixed(0),"%"]})]}),e.jsxs("div",{className:"news-ai-screen__summary-counts",children:[e.jsxs("div",{className:"news-ai-screen__summary-count",children:[e.jsx("span",{style:{color:"var(--hud-green)"},children:"BULLISH"}),e.jsx("span",{children:n.bullish})]}),e.jsxs("div",{className:"news-ai-screen__summary-count",children:[e.jsx("span",{style:{color:"var(--hud-red)"},children:"BEARISH"}),e.jsx("span",{children:n.bearish})]}),e.jsxs("div",{className:"news-ai-screen__summary-count",children:[e.jsx("span",{style:{color:"var(--hud-text-dim)"},children:"NEUTRAL"}),e.jsx("span",{children:n.neutral})]})]})]})}function G({macroData:a}){return e.jsx("div",{className:"macro-strip",children:z.map(n=>{const t=a[n]||a[n.toLowerCase()]||{},i=t.price??t.value??"--",r=t.change_pct??t.changePct??null,o=r>0?"var(--hud-green)":r<0?"var(--hud-red)":"var(--hud-text-mid)";return e.jsxs("div",{className:"macro-item",children:[e.jsx("span",{className:"macro-item__label",children:n}),e.jsxs("span",{className:"macro-item__value",children:[typeof i=="number"?i.toLocaleString(void 0,{maximumFractionDigits:2}):i,r!==null&&e.jsxs("span",{style:{color:o,fontSize:8,marginLeft:4},children:[r>0?"+":"",typeof r=="number"?r.toFixed(2):r,"%"]})]})]},n)})})}function $(){const{activeSymbol:a,articles:n,setArticles:t}=O(),[i,r]=l.useState("general"),[o,x]=l.useState(""),[m,h]=l.useState(!1),[d,w]=l.useState(null),[v,k]=l.useState([]),[f,I]=l.useState(a||"AAPL"),[y,T]=l.useState("technical"),[N,b]=l.useState(""),[_,j]=l.useState(!1),[S,A]=l.useState(null),[D,M]=l.useState({});l.useEffect(()=>{let s=!1;async function c(){h(!0),w(null);try{const u=await Y(a||"",i,30);if(s)return;const L=u.articles||u.feed||u||[];k(L),t(L)}catch(u){s||w(u.message)}finally{s||h(!1)}}return c(),()=>{s=!0}},[a,i,t]),l.useEffect(()=>{let s=!1;async function c(){try{const u=await U();s||M(u||{})}catch{}}return c(),()=>{s=!0}},[]);const E=async()=>{if(f.trim()){j(!0),A(null),b("");try{const s={technical:["RSI","MACD","BBANDS","SMA","EMA"],fundamental:["PE","EPS","REVENUE"],sentiment:["NEWS_SENTIMENT","SOCIAL"],macro:["DXY","VIX","YIELD"],risk:["ATR","BETA","VAR"]},c=await B(f.trim().toUpperCase(),"1D",s[y]||["RSI","MACD"]);b(c.response||c.analysis||JSON.stringify(c,null,2))}catch(s){A(s.message)}finally{j(!1)}}},g=((v.length?v:n)||[]).filter(s=>{if(!o)return!0;const c=o.toLowerCase();return(s.title||"").toLowerCase().includes(c)||(s.source||"").toLowerCase().includes(c)});return e.jsxs("div",{className:"news-ai-screen",children:[e.jsx("div",{className:"news-ai-screen__left",children:e.jsxs(p,{title:"NEWS FEED",scanning:m,children:[e.jsx("div",{className:"hud-filter-bar",children:F.map(s=>e.jsx("button",{className:`filter-pill ${i===s?"filter-pill--active":""}`,onClick:()=>r(s),children:s},s))}),e.jsx("div",{className:"news-search",children:e.jsx("input",{className:"hud-input",type:"text",placeholder:"Search headlines...",value:o,onChange:s=>x(s.target.value)})}),e.jsxs("div",{className:"hud-panel-body",children:[m&&e.jsx("div",{className:"news-ai-screen__status",children:"SCANNING FEEDS..."}),d&&e.jsxs("div",{className:"news-ai-screen__status",style:{color:"var(--hud-red)"},children:["ERROR: ",d]}),!m&&g.length===0&&e.jsx("div",{className:"news-ai-screen__status",children:"NO ARTICLES FOUND"}),g.map((s,c)=>e.jsx(H,{article:s},s.url||c))]})]})}),e.jsxs("div",{className:"news-ai-screen__right",children:[e.jsxs(p,{title:"AI ANALYSIS",className:"news-ai-screen__analysis-panel",children:[e.jsxs("div",{className:"news-ai-screen__controls",children:[e.jsxs("div",{className:"news-ai-screen__control-row",children:[e.jsx("label",{className:"hud-readout__label",children:"SYMBOL"}),e.jsx("input",{className:"hud-input",type:"text",value:f,onChange:s=>I(s.target.value.toUpperCase()),onKeyDown:s=>s.key==="Enter"&&E(),placeholder:"AAPL"})]}),e.jsxs("div",{className:"news-ai-screen__control-row",children:[e.jsx("label",{className:"hud-readout__label",children:"ANALYSIS TYPE"}),e.jsx("select",{className:"hud-select",value:y,onChange:s=>T(s.target.value),style:{width:"100%"},children:P.map(s=>e.jsx("option",{value:s.value,children:s.label},s.value))})]}),e.jsx("button",{className:"news-ai-screen__run-btn",onClick:E,disabled:_,children:_?"ANALYSING...":"RUN ANALYSIS"})]}),e.jsxs("div",{className:"ai-panel-body",children:[S&&e.jsxs("div",{style:{color:"var(--hud-red)",marginBottom:8},children:["ERROR: ",S]}),N?e.jsx("pre",{children:N}):!_&&e.jsx("div",{className:"news-ai-screen__status",children:"SELECT SYMBOL AND RUN ANALYSIS"})]})]}),e.jsx(p,{title:"SENTIMENT SUMMARY",className:"news-ai-screen__sentiment-panel",children:e.jsx("div",{style:{padding:10},children:e.jsx(V,{articles:g})})})]}),e.jsx("div",{className:"news-ai-screen__bottom",children:e.jsx(p,{title:"MACRO DASHBOARD",children:e.jsx(G,{macroData:D})})}),e.jsx("style",{children:`
        .news-ai-screen {
          display: grid;
          grid-template-columns: 40% 60%;
          grid-template-rows: 1fr auto;
          gap: 2px;
          height: 100%;
          min-height: 0;
          background: var(--hud-bg);
          padding: 2px;
        }

        .news-ai-screen__left {
          grid-row: 1;
          grid-column: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .news-ai-screen__left > .hud-panel {
          flex: 1;
          min-height: 0;
        }

        .news-ai-screen__right {
          grid-row: 1;
          grid-column: 2;
          display: grid;
          grid-template-rows: 1fr auto;
          gap: 2px;
          min-height: 0;
        }

        .news-ai-screen__analysis-panel {
          min-height: 0;
        }

        .news-ai-screen__sentiment-panel {
          max-height: 140px;
        }

        .news-ai-screen__bottom {
          grid-row: 2;
          grid-column: 1 / -1;
        }

        .news-ai-screen__controls {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-bottom: 1px solid var(--hud-line);
          flex-shrink: 0;
        }

        .news-ai-screen__control-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .news-ai-screen__run-btn {
          width: 100%;
          padding: 8px 12px;
          font-family: var(--hud-font);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid var(--hud-green);
          background: rgba(0, 204, 136, 0.06);
          color: var(--hud-green);
          transition: all 120ms;
        }

        .news-ai-screen__run-btn:hover:not(:disabled) {
          background: rgba(0, 204, 136, 0.15);
          box-shadow: 0 0 12px rgba(0, 204, 136, 0.12);
        }

        .news-ai-screen__run-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .news-ai-screen__sentiment-tag {
          font-family: var(--hud-font);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1px;
          padding: 1px 6px;
          text-transform: uppercase;
        }

        .news-ai-screen__confidence {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 0 2px;
        }

        .news-ai-screen__confidence-track {
          flex: 1;
          height: 2px;
          background: var(--hud-text-dim);
          overflow: hidden;
        }

        .news-ai-screen__confidence-fill {
          height: 100%;
          transition: width 300ms ease;
        }

        .news-ai-screen__confidence-label {
          font-family: var(--hud-font);
          font-size: 7px;
          color: var(--hud-text-mid);
          letter-spacing: 0.5px;
          min-width: 24px;
          text-align: right;
        }

        .news-ai-screen__source-link {
          display: inline-block;
          margin-top: 5px;
          font-family: var(--hud-font);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--hud-text-mid);
          text-decoration: none;
          text-transform: uppercase;
          transition: color 80ms;
        }

        .news-ai-screen__source-link:hover {
          color: var(--hud-text-bright);
        }

        .news-ai-screen__status {
          padding: 20px;
          text-align: center;
          font-family: var(--hud-font);
          font-size: 9px;
          color: var(--hud-text-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .news-ai-screen__summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .news-ai-screen__summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .news-ai-screen__summary-counts {
          display: flex;
          gap: 16px;
        }

        .news-ai-screen__summary-count {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: var(--hud-font);
          font-size: 8px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .news-ai-screen__summary-count span:last-child {
          font-size: 14px;
          font-weight: 700;
          color: var(--hud-text-bright);
        }
      `})]})}export{$ as default};
