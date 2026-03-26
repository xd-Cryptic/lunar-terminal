import{u as Y,r as u,j as e,H as b,h as U}from"./index-DeIgpUXC.js";const Q=["1m","5m","15m","1H","4H","1D","1W"],X=["SMA","EMA","RSI","MACD","BBANDS","VWAP","ATR","ICHIMOKU","STOCH","ADX","OBV"],G=["SPY","QQQ","BTC","GOLD","DXY"],K=[{name:"Doji",desc:"Indecision - open equals close"},{name:"Hammer",desc:"Bullish reversal at support"},{name:"Engulfing Bull",desc:"Strong bullish reversal"},{name:"Engulfing Bear",desc:"Strong bearish reversal"},{name:"Morning Star",desc:"Three-candle bullish reversal"},{name:"Evening Star",desc:"Three-candle bearish reversal"},{name:"Shooting Star",desc:"Bearish reversal at resistance"},{name:"Three White Soldiers",desc:"Strong bullish continuation"},{name:"Three Black Crows",desc:"Strong bearish continuation"},{name:"Spinning Top",desc:"Indecision with small body"}],q={SPY:[1,.92,.35,.12,-.18],QQQ:[.92,1,.42,.08,-.22],BTC:[.35,.42,1,-.1,-.38],GOLD:[.12,.08,-.1,1,-.55],DXY:[-.18,-.22,-.38,-.55,1]};function J(r){return r>=70?{text:"OVERBOUGHT",color:"var(--hud-red)"}:r<=30?{text:"OVERSOLD",color:"var(--hud-green)"}:{text:"NEUTRAL",color:"var(--hud-text-mid)"}}function Z(r){return r>=50?"VERY STRONG":r>=25?"STRONG":r>=20?"MODERATE":"WEAK"}function ee(r){return r>=.5?"var(--hud-green)":r>=.2?"rgba(0, 204, 136, 0.5)":r>-.2?"var(--hud-text-dim)":r>-.5?"rgba(204, 51, 85, 0.5)":"var(--hud-red)"}function h({label:r,value:i,sub:t,color:a,bars:m}){return e.jsxs("div",{className:"hud-readout",children:[e.jsx("span",{className:"hud-readout__label",children:r}),e.jsx("span",{className:"hud-readout__value",style:a?{color:a}:void 0,children:i}),t&&e.jsx("span",{style:{fontFamily:"var(--hud-font)",fontSize:7,color:a||"var(--hud-text-dim)",letterSpacing:1,textTransform:"uppercase"},children:t}),m!=null&&e.jsx("div",{className:"hud-readout__bars",children:Array.from({length:5},(p,s)=>e.jsx("span",{className:`hud-readout__bar ${s<Math.round(m/20)?"hud-readout__bar--fill":""}`},s))})]})}function te({symbol:r,activeIndicators:i}){var S,I,T,R,E,C,D,O,w,L,B,k,M,H,P,F,W;const[t,a]=u.useState(null),[m,p]=u.useState(!1);if(u.useEffect(()=>{let N=!1;async function $(){p(!0);try{const V=await U(r,"sma,ema,rsi,macd,bbands,vwap,atr,adx");N||a(V)}catch{N||a(null)}finally{N||p(!1)}}return $(),()=>{N=!0}},[r]),m)return e.jsx("div",{className:"tech-screen__placeholder",children:"LOADING INDICATORS..."});if(!t)return e.jsx("div",{className:"tech-screen__placeholder",children:"NO INDICATOR DATA"});const s=((S=t.rsi)==null?void 0:S.value)??t.rsi??null,d=((I=t.macd)==null?void 0:I.macd)??((T=t.macd)==null?void 0:T.value)??null,x=((R=t.macd)==null?void 0:R.signal)??null,f=((E=t.macd)==null?void 0:E.histogram)??((C=t.macd)==null?void 0:C.hist)??null,o=((D=t.bbands)==null?void 0:D.upper)??((O=t.bbands)==null?void 0:O.upperBand)??null,l=((w=t.bbands)==null?void 0:w.lower)??((L=t.bbands)==null?void 0:L.lowerBand)??null,n=((B=t.bbands)==null?void 0:B.middle)??((k=t.bbands)==null?void 0:k.middleBand)??null,c=((M=t.adx)==null?void 0:M.value)??t.adx??null,_=((H=t.atr)==null?void 0:H.value)??t.atr??null,v=((P=t.sma)==null?void 0:P.value)??t.sma??null,y=((F=t.ema)==null?void 0:F.value)??t.ema??null,j=((W=t.vwap)==null?void 0:W.value)??t.vwap??null;let g=null;o!=null&&l!=null&&n!=null&&o!==l&&(g=((n-l)/(o-l)*100).toFixed(0));const A=s!=null?J(s):{text:"--",color:"var(--hud-text-dim)"},z=f!=null?f>0?"EXPANDING":"CONTRACTING":"--";return e.jsxs("div",{className:"tech-screen__indicator-grid",children:[s!=null&&e.jsx(h,{label:"RSI",value:typeof s=="number"?s.toFixed(1):s,sub:A.text,color:A.color,bars:typeof s=="number"?s:50}),d!=null&&e.jsx(h,{label:"MACD",value:typeof d=="number"?d.toFixed(3):d,sub:`SIG ${x!=null?typeof x=="number"?x.toFixed(3):x:"--"} ${z}`,color:f>0?"var(--hud-green)":"var(--hud-red)"}),o!=null&&e.jsx(h,{label:"BBANDS",value:g!=null?`${g}%`:"--",sub:`U:${typeof o=="number"?o.toFixed(1):o} L:${typeof l=="number"?l.toFixed(1):l}`,bars:g!=null?Number(g):50}),c!=null&&e.jsx(h,{label:"ADX",value:typeof c=="number"?c.toFixed(1):c,sub:Z(typeof c=="number"?c:0),color:c>=25?"var(--hud-green)":"var(--hud-text-mid)"}),_!=null&&e.jsx(h,{label:"ATR",value:typeof _=="number"?_.toFixed(3):_,sub:"VOLATILITY"}),v!=null&&e.jsx(h,{label:"SMA",value:typeof v=="number"?v.toFixed(2):v}),y!=null&&e.jsx(h,{label:"EMA",value:typeof y=="number"?y.toFixed(2):y}),j!=null&&e.jsx(h,{label:"VWAP",value:typeof j=="number"?j.toFixed(2):j,sub:"VOL WEIGHTED"})]})}function re(){return e.jsxs("div",{className:"tech-screen__patterns",children:[e.jsx("div",{className:"tech-screen__pattern-notice",children:"Pattern recognition requires ML model -- see ML Screen"}),K.map(r=>e.jsxs("div",{className:"tech-screen__pattern-item",children:[e.jsx("span",{className:"tech-screen__pattern-name",children:r.name}),e.jsx("span",{className:"tech-screen__pattern-desc",children:r.desc})]},r.name))]})}function ne(){return e.jsxs("div",{className:"tech-screen__correlation",children:[e.jsxs("div",{className:"tech-screen__corr-row tech-screen__corr-header",children:[e.jsx("span",{className:"tech-screen__corr-cell tech-screen__corr-label"}),G.map(r=>e.jsx("span",{className:"tech-screen__corr-cell tech-screen__corr-header-cell",children:r},r))]}),G.map((r,i)=>e.jsxs("div",{className:"tech-screen__corr-row",children:[e.jsx("span",{className:"tech-screen__corr-cell tech-screen__corr-label",children:r}),q[r].map((t,a)=>e.jsx("span",{className:"tech-screen__corr-cell",style:{color:ee(t),fontWeight:i===a?800:600,opacity:i===a?.5:1},children:t.toFixed(2)},a))]},r))]})}function se(){const{activeSymbol:r}=Y(),[i,t]=u.useState(r||"AAPL"),[a,m]=u.useState(r||"AAPL"),[p,s]=u.useState("1D"),[d,x]=u.useState(["SMA","EMA","RSI","MACD","BBANDS"]),f=u.useRef(null),o=n=>{x(c=>c.includes(n)?c.filter(_=>_!==n):[...c,n])},l=()=>{const n=a.trim().toUpperCase();n&&t(n)};return e.jsxs("div",{className:"tech-screen",children:[e.jsx("div",{className:"tech-screen__controls",children:e.jsx(b,{title:"TECHNICAL ANALYSIS",children:e.jsxs("div",{className:"tech-screen__control-bar",children:[e.jsxs("div",{className:"tech-screen__symbol-input",children:[e.jsx("input",{className:"hud-input",type:"text",value:a,onChange:n=>m(n.target.value.toUpperCase()),onKeyDown:n=>n.key==="Enter"&&l(),placeholder:"SYMBOL",style:{width:90}}),e.jsx("button",{className:"tech-screen__go-btn",onClick:l,children:"GO"})]}),e.jsx("div",{className:"tech-screen__timeframes",children:Q.map(n=>e.jsx("button",{className:`interval-tab ${p===n?"interval-tab--active":""}`,onClick:()=>s(n),children:n},n))}),e.jsx("div",{className:"tech-screen__indicators",children:X.map(n=>e.jsx("button",{className:`ind-badge ${d.includes(n)?"ind-badge--active":""}`,onClick:()=>o(n),children:n},n))})]})})}),e.jsx("div",{className:"tech-screen__chart",children:e.jsx(b,{title:`${i} -- ${p}`,scanning:!0,children:e.jsx("div",{className:"tech-screen__chart-area",ref:f,children:e.jsxs("div",{className:"tech-screen__chart-placeholder",children:[e.jsx("div",{className:"tech-screen__chart-placeholder-icon",children:e.jsxs("svg",{width:"48",height:"48",viewBox:"0 0 48 48",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[e.jsx("circle",{cx:"24",cy:"24",r:"18",stroke:"rgba(180,185,200,0.15)",strokeWidth:"1"}),e.jsx("circle",{cx:"24",cy:"24",r:"8",stroke:"rgba(180,185,200,0.1)",strokeWidth:"1"}),e.jsx("line",{x1:"24",y1:"2",x2:"24",y2:"14",stroke:"rgba(180,185,200,0.12)",strokeWidth:"1"}),e.jsx("line",{x1:"24",y1:"34",x2:"24",y2:"46",stroke:"rgba(180,185,200,0.12)",strokeWidth:"1"}),e.jsx("line",{x1:"2",y1:"24",x2:"14",y2:"24",stroke:"rgba(180,185,200,0.12)",strokeWidth:"1"}),e.jsx("line",{x1:"34",y1:"24",x2:"46",y2:"24",stroke:"rgba(180,185,200,0.12)",strokeWidth:"1"})]})}),e.jsx("span",{children:"CHART AREA -- Lightweight Charts renders here"}),e.jsxs("span",{className:"tech-screen__chart-sub",children:[i," | ",p," | ",d.join(", ")]})]})})})}),e.jsxs("div",{className:"tech-screen__bottom",children:[e.jsx("div",{className:"tech-screen__bottom-left",children:e.jsx(b,{title:"INDICATOR DASHBOARD",children:e.jsx("div",{className:"hud-panel-body",style:{padding:8},children:e.jsx(te,{symbol:i,activeIndicators:d})})})}),e.jsx("div",{className:"tech-screen__bottom-center",children:e.jsx(b,{title:"PATTERN RECOGNITION",children:e.jsx("div",{className:"hud-panel-body",style:{padding:8},children:e.jsx(re,{})})})}),e.jsx("div",{className:"tech-screen__bottom-right",children:e.jsx(b,{title:"CORRELATION MATRIX",children:e.jsx("div",{className:"hud-panel-body",style:{padding:8},children:e.jsx(ne,{})})})})]}),e.jsx("style",{children:`
        .tech-screen {
          display: grid;
          grid-template-rows: auto 1fr 220px;
          gap: 2px;
          height: 100%;
          min-height: 0;
          background: var(--hud-bg);
          padding: 2px;
        }

        .tech-screen__controls {
          flex-shrink: 0;
        }

        .tech-screen__control-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          flex-wrap: wrap;
        }

        .tech-screen__symbol-input {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .tech-screen__go-btn {
          padding: 4px 10px;
          font-family: var(--hud-font);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid var(--hud-line-active);
          background: rgba(180, 185, 200, 0.04);
          color: var(--hud-text);
          transition: all 80ms;
        }

        .tech-screen__go-btn:hover {
          background: rgba(180, 185, 200, 0.1);
          border-color: var(--hud-text-mid);
        }

        .tech-screen__timeframes {
          display: flex;
          gap: 2px;
        }

        .tech-screen__indicators {
          display: flex;
          gap: 2px;
          flex-wrap: wrap;
          margin-left: auto;
        }

        .tech-screen__chart {
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .tech-screen__chart > .hud-panel {
          flex: 1;
          min-height: 0;
        }

        .tech-screen__chart-area {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .tech-screen__chart-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-family: var(--hud-font);
          font-size: 10px;
          color: var(--hud-text-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .tech-screen__chart-placeholder-icon {
          opacity: 0.6;
          margin-bottom: 4px;
        }

        .tech-screen__chart-sub {
          font-size: 8px;
          color: var(--hud-text-dim);
          letter-spacing: 1px;
          opacity: 0.6;
        }

        .tech-screen__bottom {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 2px;
          min-height: 0;
        }

        .tech-screen__bottom-left,
        .tech-screen__bottom-center,
        .tech-screen__bottom-right {
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .tech-screen__bottom-left > .hud-panel,
        .tech-screen__bottom-center > .hud-panel,
        .tech-screen__bottom-right > .hud-panel {
          flex: 1;
          min-height: 0;
        }

        /* Indicator grid */
        .tech-screen__indicator-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 6px;
        }

        /* Pattern recognition */
        .tech-screen__patterns {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tech-screen__pattern-notice {
          font-family: var(--hud-font);
          font-size: 8px;
          color: var(--hud-amber);
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 0;
          border-bottom: 1px solid var(--hud-line);
          margin-bottom: 4px;
        }

        .tech-screen__pattern-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 2px 0;
          opacity: 0.4;
        }

        .tech-screen__pattern-name {
          font-family: var(--hud-font);
          font-size: 9px;
          font-weight: 700;
          color: var(--hud-text-mid);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .tech-screen__pattern-desc {
          font-family: var(--hud-font);
          font-size: 7px;
          color: var(--hud-text-dim);
          letter-spacing: 0.5px;
        }

        /* Correlation matrix */
        .tech-screen__correlation {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tech-screen__corr-row {
          display: grid;
          grid-template-columns: 36px repeat(5, 1fr);
          gap: 2px;
        }

        .tech-screen__corr-header {
          border-bottom: 1px solid var(--hud-line);
          padding-bottom: 3px;
          margin-bottom: 2px;
        }

        .tech-screen__corr-cell {
          font-family: var(--hud-font);
          font-size: 9px;
          font-weight: 600;
          text-align: center;
          padding: 2px 0;
          color: var(--hud-text-mid);
        }

        .tech-screen__corr-label {
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--hud-text-dim);
          text-align: left;
        }

        .tech-screen__corr-header-cell {
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--hud-text-dim);
          text-transform: uppercase;
        }

        .tech-screen__placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-family: var(--hud-font);
          font-size: 9px;
          color: var(--hud-text-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }
      `})]})}export{se as default};
