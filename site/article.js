(function(){
var d=document,E=d.documentElement,C=E.classList,SHOW_EN="Show English",EXH="Example",FOOT={"copy": "Copy link", "done": "Link copied", "share": "Share"},MORE={"one": "Show 1 more example", "many": "Show {n} more examples"};
function kid(n,c){for(var k=n.firstChild;k;k=k.nextSibling)
 if(k.classList&&k.classList.contains(c))return k;return null;}
function foot(){
 var f=d.querySelector('.ordpar-card-foot');
 if(!f||!E.hasAttribute('data-article-id')||f.querySelector('.ordpar-result-controls'))return;
 var p=d.createElement('p');p.className='ordpar-result-controls';
 function el(t,c,id,x){var n=d.createElement(t);n.className=c;n.id=id;n.hidden=true;n.textContent=x;
  if(t==='button')n.type='button';p.appendChild(n);return n;}
 el('button','ordpar-result-btn','ordpar-copy',FOOT.copy);
 el('span','ordpar-result-copied','ordpar-copied',FOOT.done).setAttribute('role','status');
 el('button','ordpar-result-btn','ordpar-share',FOOT.share);f.insertBefore(p,f.firstChild);}
foot();
function cues(){
 if(!C.contains('ordpar-defs-no'))return;
 var ps=d.querySelectorAll('.ordpar-pair');
 for(var i=0;i<ps.length;i++){var p=ps[i];if(p._c)continue;p._c=1;
  var bt=d.createElement('button');bt.type='button';bt.className='ordbok-cue ordpar-encue';
  bt.textContent=SHOW_EN;p.insertBefore(bt,p.lastElementChild);}}
function excues(r){
 if(!C.contains('ordpar-examples-no'))return;
 var es=(r||d).querySelectorAll('.ordbok-ex-list>li>.ordpar-en');
 for(var i=0;i<es.length;i++){var e=es[i],li=e.parentNode;if(kid(li,'ordpar-excue'))continue;
  var bt=d.createElement('button');bt.type='button';bt.className='ordbok-cue ordpar-encue ordpar-excue';
  bt.textContent=SHOW_EN;li.insertBefore(bt,e);}}
window.ordparExCues=excues;
var XL='.ordbok-sec>.ordbok-senses>li>ul.ordbok-ex-list,.ordbok-sec>div[id]>ul.ordbok-ex-list,'+
 '.ordpar-mbody>.ordbok-senses>li>ul.ordbok-ex-list,.ordpar-msense>ul.ordbok-ex-list';
function exheads(r){
 if(!C.contains('ordpar-layout-ordbokene'))return;
 var ls=(r||d).querySelectorAll(XL);
 for(var i=0;i<ls.length;i++){var u=ls[i],q=u.previousElementSibling;
  if(q&&q.classList.contains('ordpar-exhead'))continue;
  var m=u.closest('.ordbok-xmini'),h=d.createElement(m?'div':'h4');h.className='ordpar-exhead';
  h.textContent=EXH;
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
  b.firstChild.textContent=(h===1?MORE.one:MORE.many).replace('{n}',h);}}
window.ordparExMore=exmore;
function infl(){
 var o;try{o=localStorage.getItem('infl')==='open';}catch(e){}
 var ts=d.querySelectorAll('details.ordpar-infl-toggle');
 for(var i=0;i<ts.length;i++){if(ts[i]._i)continue;ts[i]._i=1;if(o)ts[i].open=true;}}
window.ordparDefs=function(){
 var M=window.ordparMinis;if(M&&M.scan)M.scan();cues();excues();exheads();exmore();infl();};
try{window.ordparDefs();}catch(e){}
d.addEventListener('click',function(e){
 var t=e.target;if(!t||!t.closest)return;
 var x=t.closest('.ordpar-exbtn');if(x){var li=x.parentNode,u=li.parentNode,f=d.activeElement===x;
  u.classList.add('ordpar-exopen');u.removeChild(li);var o=u.children[exlim()];
  if(f&&o){o.tabIndex=-1;o.focus({preventScroll:true});}return;}
 var c=t.closest('.ordpar-encue');if(c){c.parentNode.classList.add('ordpar-open');return;}
 if(t.closest('a,label,button'))return;
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
 var o=d.createElement('script');o.src="/site/offline.js?v=ed58e9bd78";d.head.appendChild(o);}).catch(function(){});
})();