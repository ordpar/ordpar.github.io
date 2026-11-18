(function(){
var d=document,E=d.documentElement,C=E.classList,SHOW_EN="Show English",EXH="Example",FOOT={"copy": "Copy link", "done": "Link copied", "share": "Share"},MORE={"one": "Show 1 more example", "many": "Show {n} more examples"},EYE="Hide the examples' English",EYEA={"hide": "Hide the English", "show": "Show the English"},NB={"showEn": "Vis engelsk", "exh": "Eksempel", "more": "Vis {n} eksempler til", "moreOne": "Vis 1 eksempel til"};
function kid(n,c){for(var k=n.firstChild;k;k=k.nextSibling)
 if(k.classList&&k.classList.contains(c))return k;return null;}
function lab(n,en,nb){n.textContent='';if(!nb||nb===en){n.textContent=en;return n;}
 var a=d.createElement('span');a.className='ordpar-l-en';a.textContent=en;
 var b=d.createElement('span');b.className='ordpar-l-nb';b.lang='nb';b.setAttribute('data-nosnippet','');b.textContent=nb;
 n.appendChild(a);n.appendChild(b);return n;}
function foot(){
 var f=d.querySelector('.ordpar-card-foot');
 if(!f||!E.hasAttribute('data-article-id')||f.querySelector('.ordpar-result-controls'))return;
 var p=d.createElement('p');p.className='ordpar-result-controls';
 function el(t,c,id,x,y){var n=d.createElement(t);n.className=c;n.id=id;n.hidden=true;lab(n,x,y);
  if(t==='button')n.type='button';p.appendChild(n);return n;}
 el('button','ordpar-result-btn','ordpar-copy',FOOT.copy);
 el('span','ordpar-result-copied','ordpar-copied',FOOT.done).setAttribute('role','status');
 el('button','ordpar-result-btn','ordpar-share',FOOT.share);
 var R=window.ordparReport,b=R&&R.mount?R.mount(p,E.getAttribute('data-article-id')):null;
 f.insertBefore(p,f.firstChild);
 if(b&&R.fromAddress)R.fromAddress(b);}
foot();
function cues(){
 if(!C.contains('ordpar-defs-no'))return;
 var ps=d.querySelectorAll('.ordpar-pair');
 for(var i=0;i<ps.length;i++){var p=ps[i];if(p._c)continue;p._c=1;
  var bt=d.createElement('button');bt.type='button';bt.className='ordbok-cue ordpar-encue';
  lab(bt,SHOW_EN,NB.showEn);p.insertBefore(bt,p.lastElementChild);}}
function excues(r,f){
 if(!f&&!C.contains('ordpar-examples-no'))return;
 var es=(r||d).querySelectorAll('.ordbok-ex-list>li>.ordpar-en');
 for(var i=0;i<es.length;i++){var e=es[i],li=e.parentNode;if(kid(li,'ordpar-excue')||f&&e.closest('.ordbok-xmini'))continue;
  var bt=d.createElement('button');bt.type='button';bt.className='ordbok-cue ordpar-encue ordpar-excue';
  lab(bt,SHOW_EN,NB.showEn);li.insertBefore(bt,e);}}
window.ordparExCues=excues;
var EX0=null,EYEI='<svg class="ordpar-i-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '+
 'stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/>'+
 '<circle cx="12" cy="12" r="3"/></svg><svg class="ordpar-i-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" '+
 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/>'+
 '<circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';
function exitems(a){var r=[],es=a.querySelectorAll('.ordbok-ex-list>li>.ordpar-en');
 for(var i=0;i<es.length;i++)if(!es[i].closest('.ordbok-xmini'))r.push(es[i].parentNode);return r;}
function exhidden(a){var c=a.classList;
 return c.contains('ordpar-exhide')||C.contains('ordpar-examples-no')&&!c.contains('ordpar-exshown');}
var EN_SEL='.ordbok-head>.ordpar-gloss,.ordpar-pair>span.ordbok-def[lang="en"],.ordbok-ex-list>li>.ordpar-en,.ordbok-idiom-eng',
 EN_OFF='.ordbok-xpeek,.ordbok-xmini,template,.ordpar-row-button',EA0=null,SIG0=null;
function eyeall(){return C.contains('ordpar-exeye-all');}
function enOf(a){var r=[],xs=a.querySelectorAll(EN_SEL);
 for(var i=0;i<xs.length;i++)if(/\S/.test(xs[i].textContent)&&!xs[i].closest(EN_OFF))r.push(xs[i]);return r;}
function enLines(a){var out=[],xs=enOf(a);
 for(var i=0;i<xs.length;i++){var x=xs[i];
  if(getComputedStyle(x).display==='none')continue;
  if(!x.classList.contains('ordbok-def')||!x.querySelector('br')){out.push(x);continue;}
  var ks=[].slice.call(x.childNodes),s=null;
  for(var k=0;k<ks.length;k++){if(ks[k].nodeName==='BR'){s=null;continue;}
   if(!s){s=d.createElement('span');s.className='ordpar-eyel';x.insertBefore(s,ks[k]);out.push(s);}
   s.appendChild(ks[k]);}
  x.setAttribute('data-ordpar-eyel','');}
 return out.filter(function(l){return /\S/.test(l.textContent);});}
function ecue(l){var b=d.createElement('button');b.type='button';b.className='ordbok-cue';b.setAttribute('data-ordpar-eyecue','');
 lab(b,SHOW_EN,NB.showEn);b._l=l;return b;}
function ehide(l,a){var b=ecue(l);l.classList.add('ordpar-eyehid');l.parentNode.insertBefore(b,l);
 if(!l.closest('.ordbok-ex-list>li'))fitcue(b,l,a);return b;}
function fitcue(b,l,a){
 if(!a.getClientRects().length||!b.getClientRects().length)return;
 l.classList.remove('ordpar-eyehid');b.style.display='none';
 var cs=getComputedStyle(l),lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;
 var rs=l.getClientRects(),tops=[],q,z;
 for(q=0;q<rs.length;q++){if(!rs[q].height)continue;
  for(z=0;z<tops.length&&Math.abs(tops[z]-rs[q].top)>=lh/2;z++){}
  if(z===tops.length)tops.push(rs[q].top);}
 var rows=Math.max(1,rs.length>1?tops.length:Math.round(l.getBoundingClientRect().height/lh)||1);
 var want=a.getBoundingClientRect().height-(rows-1)*lh;
 l.classList.add('ordpar-eyehid');b.style.display='';
 var f=null,h=0,m=0;
 for(var k=0;k<2;k++){var dh=want-a.getBoundingClientRect().height;
  if(Math.abs(dh)<=0.05)break;
  if(dh>0||h>0){
   if(!f){f=d.createElement('span');f.className='ordpar-eyefill';f.setAttribute('aria-hidden','true');
    b.parentNode.insertBefore(f,b.nextSibling);b._f=f;}
   var nh=Math.max(0,h+dh);if(nh===0&&dh<0)m+=dh+h;h=nh;f.style.height=h+'px';}
  else m+=dh;
  b.style.marginBottom=m?m+'px':'';}}
function ereveal(b){var l=b._l;if(!l||!b.parentNode)return;
 if(b._f&&b._f.parentNode)b._f.parentNode.removeChild(b._f);
 b.parentNode.removeChild(b);l.classList.remove('ordpar-eyehid');l.classList.add('ordpar-eyeshown');}
function erehide(l){var a=l.closest('.ordpar-blanked');if(!a)return;
 l.classList.remove('ordpar-eyeshown');var b=ehide(l,a);try{b.focus({preventScroll:true});}catch(e){}}
function off2(el,x,y){el.classList.remove(x,y);if(!el.classList.length)el.removeAttribute('class');}
function blank(a){a.classList.add('ordpar-blanked');
 var ps=a.querySelectorAll('.ordpar-pair,.ordbok-ex-list>li'),i;
 for(i=0;i<ps.length;i++)if(!ps[i].classList.contains('ordpar-open')&&!ps[i].closest('.ordbok-xmini,.ordbok-inline'))
  ps[i].classList.add('ordpar-open','ordpar-eyeopened');
 var ls=enLines(a);for(i=0;i<ls.length;i++)ehide(ls[i],a);
 var r=a.closest('.ordpar-row');if(r)r.classList.add('ordpar-row-blanked');}
function unblank(a){
 var x=a.querySelectorAll('[data-ordpar-eyecue],.ordpar-eyefill'),i;
 for(i=0;i<x.length;i++)x[i].parentNode.removeChild(x[i]);
 x=a.querySelectorAll('.ordpar-eyehid,.ordpar-eyeshown');
 for(i=0;i<x.length;i++)off2(x[i],'ordpar-eyehid','ordpar-eyeshown');
 x=a.querySelectorAll('[data-ordpar-eyel]');
 for(i=0;i<x.length;i++){var ss=x[i].querySelectorAll('.ordpar-eyel');
  for(var j=0;j<ss.length;j++){while(ss[j].firstChild)x[i].insertBefore(ss[j].firstChild,ss[j]);x[i].removeChild(ss[j]);}
  x[i].removeAttribute('data-ordpar-eyel');}
 x=a.querySelectorAll('.ordpar-eyeopened');
 for(i=0;i<x.length;i++)off2(x[i],'ordpar-open','ordpar-eyeopened');
 a.classList.remove('ordpar-blanked');
 var r=a.closest('.ordpar-row');if(r)r.classList.remove('ordpar-row-blanked');}
function eyesig(){var r=[];for(var i=0;i<C.length;i++)
 if(/^ordpar-(exeye|defs-|examples|nbo|formulas|ety|subsen|layout|exlimit|exmore|emph|labels)/.test(C[i]))r.push(C[i]);
 return r.sort().join(' ');}
function eyereset(){var s=eyesig();
 if(SIG0!==null&&s!==SIG0){var bs=d.querySelectorAll('.ordpar-blanked');for(var i=0;i<bs.length;i++)unblank(bs[i]);}
 SIG0=s;}
function elabel(b,a){var all=eyeall(),p=all?a.classList.contains('ordpar-blanked'):exhidden(a),
 w=all?(p?EYEA.show:EYEA.hide):EYE;
 b.setAttribute('aria-label',w);b.title=w;b.setAttribute('aria-pressed',p?'true':'false');}
var NBI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '+
 'stroke-linejoin="round"><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5V15H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>'+
 '<path d="M17.5 9H20a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.2-3H12" opacity=".55"/></svg>';
function nbhw(){
 var S=window.ordparShell,off=!S||!S.visitSetting||C.contains('ordpar-nbicon-off'),i;
 var as=d.querySelectorAll('.ordpar-article');
 for(i=0;i<as.length;i++){var a=as[i],h=kid(a,'ordbok-head');
  if(!h||a.closest('.ordbok-xmini,.ordpar-row-button'))continue;
  var w=kid(h,'ordpar-nbhw');
  if(off){if(w)h.removeChild(w);continue;}
  if(!w){w=d.createElement('span');w.className='ordpar-nbhw';var b=d.createElement('button');
   b.type='button';b.className='ordpar-nbhw-btn';b.innerHTML='<span aria-hidden="true">'+NBI+'</span>';
   w.appendChild(b);var e=kid(h,'ordpar-exeye');h.insertBefore(w,e?e.nextSibling:h.firstChild);}}
 if(S&&S.syncIcons)S.syncIcons();}
function eyes(){
 var on=C.contains('ordpar-exeye-on'),no=C.contains('ordpar-examples-no'),all=eyeall(),i;
 if(!on||EX0!==null&&EX0!==no||EA0!==null&&EA0!==all){var xs=d.querySelectorAll('.ordpar-exhide,.ordpar-exshown');
  for(i=0;i<xs.length;i++){var o=exitems(xs[i]);for(var j=0;j<o.length;j++)o[j].classList.remove('ordpar-open');
   xs[i].classList.remove('ordpar-exhide','ordpar-exshown');}}
 EX0=no;EA0=all;
 if(!on){var ws=d.querySelectorAll('.ordpar-exeye');for(i=0;i<ws.length;i++)ws[i].parentNode.removeChild(ws[i]);return;}
 var as=d.querySelectorAll('.ordpar-article');
 for(i=0;i<as.length;i++){var a=as[i],h=kid(a,'ordbok-head');
  if(!h||a.closest('.ordbok-xmini,.ordpar-row-button'))continue;
  var w=kid(h,'ordpar-exeye');
  if(all?C.contains('ordpar-defs-en')||!enOf(a).length:!exitems(a).length){if(w)h.removeChild(w);continue;}
  if(!w){w=d.createElement('span');w.className='ordpar-exeye';var b=d.createElement('button');
   b.type='button';b.className='ordpar-exeye-btn';b.setAttribute('aria-label',EYE);b.title=EYE;
   b.innerHTML='<span aria-hidden="true">'+EYEI+'</span>';w.appendChild(b);h.insertBefore(w,h.firstChild);}
  elabel(w.firstChild,a);}}
function eye(b){
 var a=b.closest('.ordpar-article');if(!a)return;
 if(eyeall()){if(a.classList.contains('ordpar-blanked'))unblank(a);else blank(a);elabel(b,a);return;}
 var hid=exhidden(a),no=C.contains('ordpar-examples-no'),li=exitems(a),i;
 for(i=0;i<li.length;i++)li[i].classList.remove('ordpar-open');
 a.classList.remove('ordpar-exhide','ordpar-exshown');
 if(hid&&no){a.classList.add('ordpar-exshown');for(i=0;i<li.length;i++)li[i].classList.add('ordpar-open');}
 else if(!hid&&!no){a.classList.add('ordpar-exhide');excues(a,1);}
 b.setAttribute('aria-pressed',exhidden(a)?'true':'false');}
var XL='.ordbok-sec>.ordbok-senses>li>ul.ordbok-ex-list,.ordbok-sec>div[id]>ul.ordbok-ex-list,'+
 '.ordpar-mbody>.ordbok-senses>li>ul.ordbok-ex-list,.ordpar-msense>ul.ordbok-ex-list';
function exheads(r){
 if(!C.contains('ordpar-layout-ordbokene'))return;
 var ls=(r||d).querySelectorAll(XL);
 for(var i=0;i<ls.length;i++){var u=ls[i],q=u.previousElementSibling;
  if(q&&q.classList.contains('ordpar-exhead'))continue;
  var m=u.closest('.ordbok-xmini'),h=d.createElement(m?'div':'h4');h.className='ordpar-exhead';
  lab(h,EXH,NB.exh);
  if(!m){var s=u.closest('.ordbok-sec'),t=s&&s.querySelector('h3[aria-level]');
   if(t)h.setAttribute('aria-level',(+t.getAttribute('aria-level')||3)+1);}
  u.parentNode.insertBefore(h,u);}}
window.ordparExHeads=exheads;
function exlim(){for(var i=1;i<11;i++)if(C.contains('ordpar-exlimit-'+i))return i;return 0;}
function exmore(r){
 var n=exlim(),ls=(r||d).querySelectorAll('ul.ordbok-ex-list');
 for(var i=0;i<ls.length;i++){var u=ls[i],b=null,k=0;if(u.closest('.ordbok-xmini'))continue;
  for(var c=u.firstElementChild;c;c=c.nextElementSibling){if(c.classList.contains('ordpar-exmore'))b=c;else k++;}
  var h=n&&!u.classList.contains('ordpar-exopen')?k-n:0;
  if(h<=0){if(b)u.removeChild(b);continue;}
  if(!b){b=d.createElement('li');b.className='ordpar-exmore';var bt=d.createElement('button');
   bt.type='button';bt.className='ordbok-cue ordpar-exbtn';b.appendChild(bt);u.appendChild(b);}
  lab(b.firstChild,(h===1?MORE.one:MORE.many).replace('{n}',h),(h===1?NB.moreOne:NB.more).replace('{n}',h));}}
window.ordparExMore=exmore;
function infl(){
 var o;try{o=(window.ordparRead?window.ordparRead('infl'):localStorage.getItem('infl'))==='open';}catch(e){}
 var ts=d.querySelectorAll('details.ordpar-infl-toggle');
 for(var i=0;i<ts.length;i++){if(ts[i]._i)continue;ts[i]._i=1;if(o)ts[i].open=true;}}
var LVO={A1:1,A2:2,B1:3,B2:4,C:5};
function phgrp(g,lv){var bs=[],c,i;
 for(c=g.firstElementChild;c;c=c.nextElementSibling)if(c.classList.contains('ordbok-expr'))bs.push(c);
 if(bs.length<2)return;
 if(bs[0]._po==null)for(i=0;i<bs.length;i++)bs[i]._po=i;
 var t=bs.slice().sort(function(a,b){
  return lv&&((LVO[a.getAttribute('data-level')]||6)-(LVO[b.getAttribute('data-level')]||6))||a._po-b._po;});
 var r=bs[0],f=d.activeElement,m=0;
 for(i=0;i<t.length;i++){
  if(t[i]===r){for(r=r.nextElementSibling;r&&!r.classList.contains('ordbok-expr');r=r.nextElementSibling){}continue;}
  if(f&&t[i].contains(f))m=1;g.insertBefore(t[i],r);}
 if(m&&f.isConnected&&d.activeElement!==f)try{f.focus({preventScroll:true});}catch(e){}}
function phord(){
 var lv=C.contains('ordpar-levels-on')&&C.contains('ordpar-phraseorder-level'),ss=d.querySelectorAll('.ordpar-exprs');
 for(var i=0;i<ss.length;i++){var s=ss[i];if(s.closest('.ordbok-xmini'))continue;
  phgrp(s,lv);var u=kid(s,'ordpar-untr');if(u)phgrp(u,lv);}}
window.ordparDefs=function(){
 eyereset();var M=window.ordparMinis;if(M&&M.scan)M.scan();var A=window.ordparAudio;if(A&&A.scan)A.scan();
 cues();excues();exheads();exmore();infl();eyes();nbhw();phord();};
try{window.ordparDefs();}catch(e){}
d.addEventListener('click',function(e){
 var t=e.target;if(!t||!t.closest)return;
 var y=t.closest('.ordpar-exeye-btn');if(y){eye(y);return;}
 var z=t.closest('.ordpar-nbhw-btn'),S=window.ordparShell;
 if(z&&S&&S.visitSetting){S.visitSetting('nbonly',S.getSetting('nbonly')==='on'?'off':'on');return;}
 var x=t.closest('.ordpar-exbtn');if(x){var li=x.parentNode,u=li.parentNode,f=d.activeElement===x;
  u.classList.add('ordpar-exopen');u.removeChild(li);var o=u.children[exlim()];
  if(f&&o){o.tabIndex=-1;o.focus({preventScroll:true});}return;}
 var q=t.closest('[data-ordpar-eyecue]');if(q){ereveal(q);return;}
 var c=t.closest('.ordpar-encue');if(c){c.parentNode.classList.add('ordpar-open');return;}
 if(t.closest('a,label,button'))return;
 var l=t.closest('.ordpar-eyeshown');if(l){erehide(l);return;}
 var o=t.closest('.ordpar-open>span[lang=en],.ordbok-ex-list>li.ordpar-open>.ordpar-en');
 if(o)o.parentNode.classList.remove('ordpar-open');});
var G=8;
function place(m){
 var s=m.style;s.left='-100vw';
 var W=E.clientWidth,r=m.getBoundingClientRect();if(!r.width){s.left='';return;}
 var x=r.left-(parseFloat(getComputedStyle(m).left)||0);
 var dx=Math.min(0,W-G-(x+r.width));if(x+dx<G)dx=G-x;
 s.left=dx?dx+'px':'';}
window.ordparPlace=place;
d.addEventListener('mouseover',function(e){
 var t=e.target,x=t&&t.closest?t.closest('.ordbok-xref'):null;if(!x)return;
 var p=kid(x,'ordbok-xpeek');if(!p)return;
 p.style.removeProperty('--ordpar-peek-dx');place(p);
 var dx=parseFloat(p.style.left)||0;if(dx)p.style.setProperty('--ordpar-peek-dx',(-dx)+'px');});
window.addEventListener('resize',function(){
 var ms=d.querySelectorAll('.ordpar-mopen>.ordbok-xmini');
 for(var i=0;i<ms.length;i++)place(ms[i]);});
var c=d.getElementById('ordpar-copy');
if(c&&navigator.clipboard){c.hidden=false;c.addEventListener('click',function(){
 navigator.clipboard.writeText(location.href).then(function(){
  var s=d.getElementById('ordpar-copied');s.hidden=false;
  setTimeout(function(){s.hidden=true;},2500);});});}
var s=d.getElementById('ordpar-share');
if(s&&navigator.share){s.hidden=false;s.addEventListener('click',function(){
 navigator.share({title:d.title,url:location.href}).catch(function(){});});}
var P=window.ordparPersonal;if(P){try{P.mountPage({"label": "Favourite", "saved": "In favourites"});}catch(e){}}
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});
var K='ordpar-offline-1';
if(!window.ordparOffline&&window.caches)caches.has(K).then(function(h){
 return h&&caches.open(K).then(function(c){return c.match('/offline/__current.json');});
}).then(function(r){if(!r||window.ordparOffline)return;
 var o=d.createElement('script');o.src="/site/offline.js?v=52f30051e8";d.head.appendChild(o);}).catch(function(){});
})();