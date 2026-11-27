
(function(){
  var st=document.getElementById('st'),env=document.getElementById('env'),base=document.getElementById('base'),go=document.getElementById('go'),f2=document.getElementById('f2'),started=false,done=false,began=false,song=document.getElementById('song'),snd=document.getElementById('snd'),want=true,fade=null;
  function open(){
    if(started)return;started=true;st.classList.add('opening');
    try{song.volume=0;var sp=song.play();if(sp&&sp.catch)sp.catch(function(){});
      clearInterval(fade);fade=setInterval(function(){if(song.volume<.84)song.volume=Math.min(.85,song.volume+.03);else clearInterval(fade);},120);}catch(e){}
    var p=env.play();if(p&&p.catch)p.catch(function(){env.muted=true;env.play();});
  }
  function reveal(){
    if(done)return;done=true;st.classList.add('alive');
  }
  function bloom(){
    if(began)return;began=true;st.classList.add('bg');
    setTimeout(function(){
      st.classList.add('bloom','written');
      var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function(){st.classList.add('ready');},1500);
      setTimeout(reveal,rm?400:3200);
    },300);
  }
  env.addEventListener('ended',bloom);
  env.addEventListener('error',bloom);
  f2.addEventListener('animationend',function(){setTimeout(reveal,150);});
  snd.addEventListener('click',function(e){e.stopPropagation();want=!want;snd.setAttribute('aria-pressed',!want);snd.setAttribute('aria-label',want?'Mute music':'Play music');if(want){song.volume=.85;song.play();}else song.pause();});
  document.addEventListener('visibilitychange',function(){if(!started)return;if(document.hidden)song.pause();else if(want)song.play().catch(function(){});});
  go.addEventListener('click',open);
  st.addEventListener('click',open);
})();


(function(){
  var ROSE='/assets/final-toast/step-rose.webp';
  var EVENTS=[
    {date:'1',weekday:'Tuesday',day:'Hemoglobin Day',note:'(Red / Maroon)',night:null},
    {date:'2',weekday:'Wednesday',day:'Green Flag Day',note:'(Green)',night:null},
    {date:'3',weekday:'Thursday',day:'Hematoxylin and Eosin Day',note:'(Pink & Purple)',night:null},
    {date:'4',weekday:'Friday',day:'Daku Day',note:null,night:'History by Night'},
    {date:'5',weekday:'Saturday',day:'Mismatch Day + Bag Pack Day + Scavenger Hunt',note:null,night:null},
    {date:'6',weekday:'Sunday',day:'Picnic Day',note:null,night:null},
    {date:'7',weekday:'Monday',day:'Back-to-School Day',note:null,night:null},
    {date:'9',weekday:'Wednesday',day:'Culture Day',note:null,night:'Qawali & Mehndi Night'},
    {date:'10',weekday:'Thursday',day:'Retro Day',note:null,night:'Movie Night'},
    {date:'11',weekday:'Friday',day:'Overall Signing Ceremony',note:null,night:null},
    {date:'12',weekday:'Saturday',day:null,note:null,night:'Annual Dinner'}
  ];
  /* which days sit on each side-scroll page (indexes into EVENTS) */
  var PAGES=[[0,4],[4,8],[8,11]];
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function col(){var c=document.createElement('div');for(var i=0;i<arguments.length;i++)c.appendChild(arguments[i]);return c;}
  function eventCol(title,note){return title?col.apply(null,[h('div',title.length>28?'et sm':'et',title)].concat(note?[h('div','eh',note)]:[])):col(h('div','dash','\u2014'));}
  function EventCard(ev,index){
    var row=h('div','row'),card=h('div','ev'),label=ev.date+' DECEMBER';
    card.dataset.s='hidden';card.setAttribute('role','group');
    card.setAttribute('aria-label',ev.date+' December, '+ev.weekday+'. Day event: '+(ev.day||'none')+(ev.note?' '+ev.note:'')+'. Night event: '+(ev.night||'none'));
    var rose=h('span','rose'),img=document.createElement('img');img.src=ROSE;img.alt='';img.draggable=false;rose.appendChild(img);
    var op=h('div','op'),ln=h('span','ln');ln.setAttribute('aria-hidden','true');
    op.appendChild(col(h('div','dn',ev.date),h('div','dm','December'),h('div','dw',ev.weekday)));
    op.appendChild(ev.none?col(h('div','noev','No events')):eventCol(ev.day,ev.note));
    op.appendChild(eventCol(ev.night,null));
    var spr=h('span','spr');spr.setAttribute('aria-hidden','true');card.appendChild(spr);card.appendChild(ln);card.appendChild(rose);card.appendChild(h('span','lab',label));card.appendChild(op);
    function finish(){
      if(card.dataset.s!=='animating')return;
      card.dataset.s='revealed';
    }
    /* sprinkles: gold sparkles are dropped behind the flower as it travels left to right */
    function trail(){
      var u=card.clientWidth/100,last=0;
      function puff(cx,cy,rw,n){
        for(var k=0;k<n;k++){
          var star=Math.random()<.35,sz=(star?1.6+Math.random()*2.2:.9+Math.random()*1.9)*u*.9;
          var el=document.createElement('i');if(star)el.className='st';
          el.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(cx-rw*(.15+Math.random()*.45)-sz/2)+'px;top:'+(cy+(Math.random()-.5)*rw*.8-sz/2)+'px';
          spr.appendChild(el);
          var dx=-(3+Math.random()*9)*u,dy=(Math.random()-.35)*7*u,dur=550+Math.random()*450;
          var a=el.animate([{transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) scale(.15) rotate('+(star?180:0)+'deg)',opacity:0}],{duration:dur,easing:'cubic-bezier(.2,.6,.3,1)',fill:'forwards'});
          a.onfinish=function(e){return function(){e.remove();};}(el);
        }
      }
      function frame(now){
        var cr=card.getBoundingClientRect(),rr=rose.getBoundingClientRect(),cx=rr.left+rr.width/2-cr.left,cy=rr.top+rr.height/2-cr.top;
        if(now-last>22){puff(cx,cy,rr.width,3);last=now;}
        if(card.dataset.s==='animating')requestAnimationFrame(frame);else puff(cx,cy,rr.width,10);
      }
      requestAnimationFrame(frame);
    }
    /* plays this card's reveal on its own, then calls done so the next card can start */
    function play(done){
      if(card.dataset.s!=='hidden'){if(done)done();return;}
      card.style.setProperty('--tr',Math.max(0,card.clientWidth-2*rose.offsetLeft-rose.offsetWidth)+'px');
      if(reduce){card.dataset.s='revealed';if(done)done();return;}
      card.dataset.s='animating';trail();
      var over=false;
      function end(){if(over)return;over=true;finish();setTimeout(function(){if(done)done();},80);}
      rose.addEventListener('animationend',function(e){if(e.animationName==='go')end();});
      setTimeout(end,1000);
    }
    row._play=play;
    row.appendChild(card);return row;
  }
  var track=document.getElementById('track'),dotsEl=document.getElementById('dots'),prev=document.getElementById('prev'),next=document.getElementById('next');
  PAGES.forEach(function(r,n){
    var sl=h('section','slide sl');sl.id='s'+(n+1);sl.setAttribute('aria-label','Golden Week 2026 event details, page '+(n+1)+' of '+PAGES.length);
    var head=h('header','pg-head rv');head.appendChild(h('h2',null,'Golden Week 2026'));head.appendChild(h('div','rule'));head.appendChild(h('p','sub','Event details'));
    sl.appendChild(head);
    var hdr=h('div','hdr rv d1');['DATE','DAY EVENT','NIGHT EVENT'].forEach(function(t){hdr.appendChild(h('span',null,t));});hdr.setAttribute('aria-hidden','true');sl.appendChild(hdr);
    var list=h('div','list rv d2'),rows=[];for(var i=r[0];i<r[1];i++){var row=EventCard(EVENTS[i],i);rows.push(row);list.appendChild(row);}
    sl._start=function(){var k=0;(function next(){if(k<rows.length)rows[k++]._play(next);else if(sl._done)setTimeout(sl._done,250);})();};
    if(n===PAGES.length-1){var end=h('footer','pg-end');end.appendChild(h('div','dia'));end.appendChild(h('p',null,'We look forward to celebrating with you.'));end.appendChild(h('small',null,'CLASS OF 2026'));end.appendChild(h('small','u2','KING EDWARD MEDICAL UNIVERSITY'));list.appendChild(end);}
    sl.appendChild(list);
    if(n===PAGES.length-1){
      var made=h('div','made');made.appendChild(h('span','mr'));made.appendChild(h('p','mb','Made by'));
      var a=h('a','mk');a.href='https://digitalinvites.tech';a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Made by Digital Invites. Want an invitation like this? Visit digitalinvites.tech');
      var pill=h('span','pill');pill.appendChild(h('span','di','Digital Invites'));var ar=h('span','ar','\u2192');ar.setAttribute('aria-hidden','true');pill.appendChild(ar);
      a.appendChild(pill);a.appendChild(h('span','cta','Want an invitation like this? Tap to visit.'));
      made.appendChild(a);sl.appendChild(made);
      /* the credit appears only once the last card has finished revealing */
      sl._done=function(){made.classList.add('show');};
      if(reduce)made.classList.add('show');
    }
    track.appendChild(sl);
  });
  var slides=[].slice.call(track.querySelectorAll('.slide')),N=slides.length,cur=0,dots=[];
  slides.forEach(function(s,i){var b=h('button');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-label','Page '+(i+1));b.addEventListener('click',function(e){e.stopPropagation();goTo(i);});dotsEl.appendChild(b);dots.push(b);});
  function goTo(i){i=Math.max(0,Math.min(N-1,i));track.scrollTo({left:i*track.clientWidth,behavior:reduce?'auto':'smooth'});}
  var settle=null;
  function activate(i){
    var sl=slides[i];if(sl.classList.contains('on'))return;
    sl.classList.add('on');
    if(sl._start)setTimeout(sl._start,reduce?0:550);
  }
  function sync(){
    var i=Math.round(track.scrollLeft/Math.max(1,track.clientWidth));cur=i;
    clearTimeout(settle);settle=setTimeout(function(){activate(cur);},160);
    dots.forEach(function(d,k){d.classList.toggle('on',k===i);d.setAttribute('aria-selected',k===i);});
    prev.classList.toggle('show',i>0);next.classList.toggle('show',i<N-1);
  }
  var tick=false;track.addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;sync();});},{passive:true});
  prev.addEventListener('click',function(e){e.stopPropagation();goTo(cur-1);});
  next.addEventListener('click',function(e){e.stopPropagation();goTo(cur+1);});
  document.getElementById('cue').addEventListener('click',function(e){e.stopPropagation();goTo(1);});
  document.addEventListener('keydown',function(e){if(!document.getElementById('st').classList.contains('ready'))return;if(e.key==='ArrowRight')goTo(cur+1);else if(e.key==='ArrowLeft')goTo(cur-1);});
  var wl=0;track.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();var t=Date.now();if(t-wl<650)return;wl=t;goTo(cur+(e.deltaY>0?1:-1));}
  },{passive:false});
  window.addEventListener('resize',function(){track.scrollLeft=cur*track.clientWidth;});
  sync();
})();
