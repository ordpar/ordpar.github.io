(function(){
var d=document,E=d.documentElement,C=E.classList,SHOW_EN="Show English",EXH="Example",FOOT={"copy": "Copy link", "done": "Link copied", "share": "Share"},MORE={"one": "Show 1 more example", "many": "Show {n} more examples"},PRON={"label": "About the pronunciation marks", "note": "Written in ordinary Norwegian spelling, not phonetic symbols. When a word is not stressed on its first syllable, a mark after the stressed syllable shows where the stress falls, and which of Norwegian's two word melodies it has: ˊ for tone 1, ˋ for tone 2. The two tones can tell apart words that are otherwise said alike, such as bønder, 'farmers' (tone 1), and bønner, 'beans' (tone 2). How they sound depends on the dialect: in Eastern Norwegian, as in Oslo, tone 1 starts low on the stressed syllable and rises, while tone 2 falls on the stressed syllable before it rises. A hyphen means only part of the word is spelt out."},EYE="Hide the examples' English",NB={"copy": "Kopier lenke", "done": "Lenke kopiert", "share": "Del", "showEn": "Vis engelsk", "exh": "Eksempel", "more": "Vis {n} eksempler til", "moreOne": "Vis 1 eksempel til"};
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
 el('button','ordpar-result-btn','ordpar-copy',FOOT.copy,NB.copy);
 el('span','ordpar-result-copied','ordpar-copied',FOOT.done,NB.done).setAttribute('role','status');
 el('button','ordpar-result-btn','ordpar-share',FOOT.share,NB.share);f.insertBefore(p,f.firstChild);}
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
 var on=C.contains('ordpar-exeye-on'),no=C.contains('ordpar-examples-no'),i;
 if(!on||EX0!==null&&EX0!==no){var xs=d.querySelectorAll('.ordpar-exhide,.ordpar-exshown');
  for(i=0;i<xs.length;i++){var o=exitems(xs[i]);for(var j=0;j<o.length;j++)o[j].classList.remove('ordpar-open');
   xs[i].classList.remove('ordpar-exhide','ordpar-exshown');}}
 EX0=no;
 if(!on){var ws=d.querySelectorAll('.ordpar-exeye');for(i=0;i<ws.length;i++)ws[i].parentNode.removeChild(ws[i]);return;}
 var as=d.querySelectorAll('.ordpar-article');
 for(i=0;i<as.length;i++){var a=as[i],h=kid(a,'ordbok-head');
  if(!h||a.closest('.ordbok-xmini,.ordpar-row-button'))continue;
  var w=kid(h,'ordpar-exeye');
  if(!exitems(a).length){if(w)h.removeChild(w);continue;}
  if(!w){w=d.createElement('span');w.className='ordpar-exeye';var b=d.createElement('button');
   b.type='button';b.className='ordpar-exeye-btn';b.setAttribute('aria-label',EYE);b.title=EYE;
   b.innerHTML='<span aria-hidden="true">'+EYEI+'</span>';w.appendChild(b);h.insertBefore(w,h.firstChild);}
  w.firstChild.setAttribute('aria-pressed',exhidden(a)?'true':'false');}}
function eye(b){
 var a=b.closest('.ordpar-article');if(!a)return;
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
var PQ=0,PO=null,PT=0;
function pronq(r){
 var hs=(r||d).querySelectorAll('.ordpar-pron-key>h3');
 for(var i=0;i<hs.length;i++){var h=hs[i];if(h._q||h.closest('.ordbok-xmini'))continue;h._q=1;
  var w=d.createElement('span');w.className='ordpar-hint';w.setAttribute('data-nosnippet','');
  var b=d.createElement('button');b.type='button';b.className='ordpar-hint-button';b.textContent='?';
  b.setAttribute('aria-label',PRON.label);b.setAttribute('aria-expanded','false');
  var l=d.createElement('span');l.className='ordpar-hint-live';l.setAttribute('role','status');
  l.id='ordpar-pron-note-'+(++PQ);b.setAttribute('aria-controls',l.id);
  w.appendChild(b);w.appendChild(l);h.parentNode.insertBefore(w,h.nextSibling);}}
function pqG(){var S=window.ordparShell;return S&&S.hintGuard;}
function pqShow(w,pin){clearTimeout(PT);if(PO&&PO.w!==w)pqHide();
 if(!PO){var x=d.createElement('span');x.className='ordpar-hint-box';x.lang='en';x.textContent=PRON.note;
  w.lastChild.appendChild(x);w.firstChild.setAttribute('aria-expanded','true');PO={w:w,pin:false};}
 if(pin){PO.pin=true;var g=pqG();if(g)g.pin(w,pqHide);}}
function pqHide(){clearTimeout(PT);if(!PO)return;var g=pqG();if(g)g.unpin(PO.w);PO.w.lastChild.textContent='';
 PO.w.firstChild.setAttribute('aria-expanded','false');PO=null;}
d.addEventListener('pointerover',function(e){if(e.pointerType!=='mouse')return;
 var w=e.target.closest&&e.target.closest('.ordpar-pron-key>.ordpar-hint');if(!w)return;
 if(PO&&PO.w===w){clearTimeout(PT);return;}if(PO&&PO.pin)return;pqShow(w,false);});
d.addEventListener('pointerout',function(e){if(e.pointerType!=='mouse'||!PO||PO.pin)return;
 var w=PO.w;if(!w.contains(e.target)||(e.relatedTarget&&w.contains(e.relatedTarget)))return;
 PT=setTimeout(function(){if(PO&&!PO.pin)pqHide();},200);});
d.addEventListener('keydown',function(e){if(PO&&e.key==='Escape')pqHide();});
window.ordparDefs=function(){
 var M=window.ordparMinis;if(M&&M.scan)M.scan();cues();excues();exheads();exmore();infl();pronq();eyes();nbhw();};
try{window.ordparDefs();}catch(e){}
d.addEventListener('click',function(e){
 var t=e.target;if(!t||!t.closest)return;
 var q=t.closest('.ordpar-pron-key>.ordpar-hint');
 if(q){if(t.closest('.ordpar-hint-button')){if(PO&&PO.w===q&&PO.pin)pqHide();else pqShow(q,true);}return;}
 if(PO)pqHide();
 var y=t.closest('.ordpar-exeye-btn');if(y){eye(y);return;}
 var z=t.closest('.ordpar-nbhw-btn'),S=window.ordparShell;
 if(z&&S&&S.visitSetting){S.visitSetting('nbonly',S.getSetting('nbonly')==='on'?'off':'on');return;}
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