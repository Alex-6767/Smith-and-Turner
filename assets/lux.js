/* =====================================================================
   SMITH & TURNER — lux.js
   - Wireframe "building" rendered in canvas-2D (real thick lines),
     perspective projection, construction build-on + slow rotation.
   - Luxurious scroll: progress bar, reveals, parallax, header state.
   - Mobile menu, consultation form (POST /api/contact + mailto fallback).
   - Degrades gracefully; respects reduced motion. No external libraries.
   ===================================================================== */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- house geometry (silhouette + faint interior studs) ---------- */
  var V = {
    A:[-1.5,0,-1], B:[1.5,0,-1], C:[1.5,0,1], D:[-1.5,0,1],
    E:[-1.5,1.45,-1], F:[1.5,1.45,-1], G:[1.5,1.45,1], H:[-1.5,1.45,1],
    R1:[0,2.35,-1], R2:[0,2.35,1]
  };
  var SIL_K = ["A","B","B","C","C","D","D","A","A","E","B","F","C","G","D","H",
    "E","F","F","G","G","H","H","E","E","R1","F","R1","H","R2","G","R2","R1","R2"];
  var SIL = []; for (var i=0;i<SIL_K.length;i+=2) SIL.push([V[SIL_K[i]],V[SIL_K[i+1]]]);
  var STUD = []; function seg(a,b){STUD.push([a,b]);}
  for (var x=-1.0;x<=1.0001;x+=0.5) seg([x,0,-1],[x,1.45,-1]);
  for (var z=-0.6;z<=0.6001;z+=0.6) seg([-1.5,0,z],[1.5,0,z]);
  seg([-1.5,1.45,-1],[0,2.35,-1]); seg([1.5,1.45,-1],[0,2.35,-1]);
  seg([-0.35,0,-1],[-0.35,0.95,-1]); seg([0.2,0,-1],[0.2,0.95,-1]); seg([-0.35,0.95,-1],[0.2,0.95,-1]);
  seg([0.7,0.6,-1],[1.15,0.6,-1]); seg([0.7,1.0,-1],[1.15,1.0,-1]); seg([0.7,0.6,-1],[0.7,1.0,-1]); seg([1.15,0.6,-1],[1.15,1.0,-1]);
  var HOUSE_H = 2.35;

  function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function nrm(a){var l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];}

  function makeScene(opts){
    var canvas = opts.canvas; if(!canvas) return null;
    var ctx = canvas.getContext("2d"); if(!ctx) return null;
    var camY=opts.camY||1.5, camZ=opts.camZ||7.4, baseRot=opts.startRotY||-0.55, useGrid=!!opts.grid;
    var scrollRot=0, built=reduce?1:0, start=null, W=0, Hn=0, DPR=1;

    function resize(){
      DPR=Math.min(window.devicePixelRatio||1,2);
      var r=canvas.getBoundingClientRect();
      W=Math.max(1,Math.round(r.width)); Hn=Math.max(1,Math.round(r.height));
      canvas.width=W*DPR; canvas.height=Hn*DPR;
    }
    resize(); window.addEventListener("resize",resize);

    function cam(){
      var C=[0,camY,camZ], L=[0,1.1,0], up=[0,1,0];
      var f=nrm(sub(L,C)), r=nrm(cross(f,up)), u=cross(r,f);
      return {C:C,f:f,r:r,u:u,focal:1/Math.tan(38*Math.PI/180/2),aspect:W/Hn};
    }
    function world(p,rotY){
      var ca=Math.cos(rotY), sa=Math.sin(rotY);
      return [p[0]*ca+p[2]*sa, p[1]-0.4, -p[0]*sa+p[2]*ca];
    }
    function proj(p,K){
      var rel=sub(p,K.C), d=dot(rel,K.f); if(d<=0.02) return null;
      var xc=dot(rel,K.r), yc=dot(rel,K.u);
      return [W/2+(xc/d)*(K.focal/K.aspect)*(W/2), Hn/2-(yc/d)*K.focal*(Hn/2), d];
    }
    function clipSeg(a,b,cy){
      var ay=a[1],by=b[1];
      if(ay<=cy&&by<=cy) return [a,b];
      if(ay>cy&&by>cy) return null;
      var t=(cy-ay)/(by-ay), m=[a[0]+(b[0]-a[0])*t, cy, a[2]+(b[2]-a[2])*t];
      return ay<=cy?[a,m]:[m,b];
    }
    function drawSet(K,set,rotY,cy,color,w){
      ctx.strokeStyle=color; ctx.lineWidth=w; ctx.lineCap="round"; ctx.lineJoin="round";
      for(var i=0;i<set.length;i++){
        var cs=clipSeg(world(set[i][0],rotY),world(set[i][1],rotY),cy); if(!cs) continue;
        var pa=proj(cs[0],K), pb=proj(cs[1],K); if(!pa||!pb) continue;
        ctx.beginPath(); ctx.moveTo(pa[0],pa[1]); ctx.lineTo(pb[0],pb[1]); ctx.stroke();
      }
    }
    function frame(t){
      if(start===null) start=t;
      if(built<1) built=Math.min(1,(t-start)/2200);
      var e=1-Math.pow(1-built,3);
      var cy=reduce?HOUSE_H+1:(-0.5+e*(HOUSE_H+1.0));
      var rotY=baseRot+(reduce?0:(t-start)/1000*0.11)+scrollRot;
      ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,Hn);
      var K=cam();
      if(useGrid){
        ctx.lineWidth=1;
        for(var g=-13;g<=13;g++){
          var a=proj(world([g,0.02,-13],rotY),K), b=proj(world([g,0.02,13],rotY),K);
          if(a&&b){ctx.strokeStyle="rgba(40,41,46,"+Math.max(0,0.26-Math.min(a[2],b[2])*0.016)+")";ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
          var c2=proj(world([-13,0.02,g],rotY),K), d2=proj(world([13,0.02,g],rotY),K);
          if(c2&&d2){ctx.strokeStyle="rgba(40,41,46,"+Math.max(0,0.26-Math.min(c2[2],d2[2])*0.016)+")";ctx.beginPath();ctx.moveTo(c2[0],c2[1]);ctx.lineTo(d2[0],d2[1]);ctx.stroke();}
        }
      }
      var scale=Math.min(1.15,Math.max(0.8,W/620));
      drawSet(K,STUD,rotY,cy,"rgba(60,61,66,0.5)",2.0*scale);
      drawSet(K,SIL,rotY,cy,"#15161A",3.4*scale);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { setScroll:function(v){scrollRot=v;}, resize:resize };
  }

  var heroScene = makeScene({canvas:document.getElementById("hero-canvas"),camY:1.5,camZ:7.4,startRotY:-0.6,grid:true});
  if(heroScene){ var fb=document.querySelector(".hero__fallback"); if(fb) fb.style.display="none"; }
  var aboutScene = makeScene({canvas:document.getElementById("about-canvas"),camY:1.5,camZ:6.8,startRotY:0.4,grid:false});

  /* ---------- animated 3D artwork tiles (spin + build-up + shaded, grainy via CSS) ---------- */
  function boxFaces(x0,x1,y0,y1,z0,z1){
    return [
      [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], // bottom
      [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], // top
      [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], // front
      [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], // back
      [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], // left
      [[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]]  // right
    ];
  }
  var GEO = {
    residential: (function(){
      var f=boxFaces(-3,3,0,4,-2,2);
      f.push([[-3,4,-2],[-3,4,2],[0,6,2],[0,6,-2]]);   // left slope
      f.push([[3,4,-2],[3,4,2],[0,6,2],[0,6,-2]]);      // right slope
      f.push([[-3,4,2],[3,4,2],[0,6,2]]);               // front gable
      f.push([[-3,4,-2],[3,4,-2],[0,6,-2]]);            // back gable
      return {faces:f,h:6,camY:4.6,camZ:17.5,look:2.5};
    })(),
    commercial: (function(){
      var f=boxFaces(-2.5,2.5,0,9,-2,2), lines=[];
      for(var y=1;y<9;y++){ lines.push([[-2.5,y,2],[2.5,y,2]]); lines.push([[2.5,y,2],[2.5,y,-2]]); }
      return {faces:f,lines:lines,h:9,camY:5.8,camZ:26,look:4.2};
    })(),
    renovations: (function(){
      var f=boxFaces(-3,1,0,4,-2,2).concat(boxFaces(1,3,0,2.4,-2,2));
      return {faces:f,h:4,camY:3.9,camZ:14.5,look:1.9};
    })(),
    "project-management": (function(){
      var f=boxFaces(-3,3,0,0.35,-2,2)
        .concat(boxFaces(-2.6,2.6,2.2,4.2,-1.6,1.6))
        .concat(boxFaces(-3,3,6.0,6.35,-2,2)), lines=[];
      [[-2.6,-1.6],[2.6,1.6],[2.6,-1.6],[-2.6,1.6]].forEach(function(c){ lines.push([[c[0],0.35,c[1]],[c[0],6.0,c[1]]]); });
      return {faces:f,lines:lines,h:6.35,camY:5.0,camZ:19,look:3.1,dashed:true};
    })()
  };
  var LIGHT=nrm([-0.35,0.86,0.42]);
  function rotY(p,a){var c=Math.cos(a),s=Math.sin(a);return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];}
  function faceNormal(f){return nrm(cross(sub(f[1],f[0]),sub(f[2],f[0])));}
  function clipYpoly(poly,cy){var out=[];for(var i=0;i<poly.length;i++){var a=poly[i],b=poly[(i+1)%poly.length];var ai=a[1]<=cy,bi=b[1]<=cy;if(ai)out.push(a);if(ai!==bi){var t=(cy-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,cy,a[2]+(b[2]-a[2])*t]);}}return out;}

  function makeArt(canvas){
    var kind=canvas.getAttribute("data-art"); var g=GEO[kind]; if(!g) return;
    var ctx=canvas.getContext("2d"); if(!ctx) return;
    var DPR,W,Hn;
    function resize(){DPR=Math.min(window.devicePixelRatio||1,2);var r=canvas.getBoundingClientRect();W=Math.max(1,Math.round(r.width));Hn=Math.max(1,Math.round(r.height));canvas.width=W*DPR;canvas.height=Hn*DPR;}
    resize(); window.addEventListener("resize",resize);
    function cam(){var C=[0,g.camY,g.camZ],L=[0,g.look,0],up=[0,1,0];var f=nrm(sub(L,C)),r=nrm(cross(f,up)),u=cross(r,f);return {C:C,f:f,r:r,u:u,focal:1/Math.tan(28*Math.PI/180/2),aspect:W/Hn};}
    function proj(p,K){var rel=sub(p,K.C),d=dot(rel,K.f);if(d<=0.02)return null;return [W/2+(dot(rel,K.r)/d)*(K.focal/K.aspect)*(W/2),Hn/2-(dot(rel,K.u)/d)*K.focal*(Hn/2),d];}
    var base=-0.62, spin=reduce?0:0.00034, start=null, replay=false, t0=null;
    function frame(t){
      if(t0===null)t0=t;
      if(start===null||replay){start=t;replay=false;}
      var built=reduce?1:Math.min(1,(t-start)/1800);
      var e=1-Math.pow(1-built,3);
      var cy=-0.02+e*(g.h+0.4);
      var ang=base+(t-t0)*spin;
      ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,Hn);
      var K=cam(), list=[];
      g.faces.forEach(function(f){
        var poly=clipYpoly(f,cy); if(poly.length<3) return;
        var n=rotY(faceNormal(f),ang);
        var sh=0.5+0.5*Math.abs(dot(n,LIGHT));
        var v=Math.max(0,Math.min(255,Math.round(sh*236)));
        var pr=poly.map(function(p){return rotY(p,ang);});
        var scr=pr.map(function(p){return proj(p,K);}); if(scr.indexOf(null)>=0) return;
        var depth=0; for(var i=0;i<scr.length;i++)depth+=scr[i][2]; depth/=scr.length;
        list.push({depth:depth,scr:scr,col:"rgb("+v+","+v+","+(v-4)+")"});
      });
      list.sort(function(a,b){return b.depth-a.depth;});
      list.forEach(function(o){
        ctx.beginPath(); ctx.moveTo(o.scr[0][0],o.scr[0][1]);
        for(var i=1;i<o.scr.length;i++)ctx.lineTo(o.scr[i][0],o.scr[i][1]);
        ctx.closePath(); ctx.fillStyle=o.col; ctx.fill();
        ctx.lineWidth=1.1; ctx.strokeStyle="rgba(40,41,46,.85)"; ctx.lineJoin="round"; ctx.stroke();
      });
      if(g.lines){ ctx.lineWidth=1; ctx.strokeStyle=g.dashed?"rgba(90,89,85,.55)":"rgba(70,70,74,.5)"; if(g.dashed)ctx.setLineDash([4,4]);
        g.lines.forEach(function(sg){ var a=sg[0],b=sg[1]; if(a[1]>cy&&b[1]>cy)return;
          var aa=a[1]<=cy?a:[a[0]+(b[0]-a[0])*((cy-a[1])/(b[1]-a[1])),cy,a[2]+(b[2]-a[2])*((cy-a[1])/(b[1]-a[1]))];
          var bb=b[1]<=cy?b:[a[0]+(b[0]-a[0])*((cy-a[1])/(b[1]-a[1])),cy,a[2]+(b[2]-a[2])*((cy-a[1])/(b[1]-a[1]))];
          var pa=proj(rotY(aa,ang),K),pb=proj(rotY(bb,ang),K); if(!pa||!pb)return;
          ctx.beginPath(); ctx.moveTo(pa[0],pa[1]); ctx.lineTo(pb[0],pb[1]); ctx.stroke();
        }); ctx.setLineDash([]);
      }
      requestAnimationFrame(frame);
    }
    if("IntersectionObserver" in window && !reduce){
      var seen=false;
      var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){ if(seen)replay=true; seen=true; }});},{threshold:0.25});
      io.observe(canvas);
    }
    requestAnimationFrame(frame);
  }
  [].slice.call(document.querySelectorAll("canvas.art[data-art]")).forEach(makeArt);


  /* ---------- hero intro ---------- */
  var hero=document.querySelector(".hero");
  if(hero) requestAnimationFrame(function(){setTimeout(function(){hero.classList.add("in");},80);});

  /* ---------- scroll: progress + parallax + header + hero rot ---------- */
  var header=document.querySelector(".hd");
  var bar=document.querySelector(".progress__bar");
  var parallax=[].slice.call(document.querySelectorAll("[data-parallax]"));
  var ticking=false;
  function onScroll(){
    if(ticking) return; ticking=true;
    requestAnimationFrame(function(){
      var y=window.scrollY||window.pageYOffset;
      var docH=document.documentElement.scrollHeight-window.innerHeight;
      if(bar) bar.style.transform="scaleX("+(docH>0?y/docH:0)+")";
      if(header) header.classList.toggle("scrolled",y>60);
      if(heroScene) heroScene.setScroll(Math.min(y/window.innerHeight,1.2)*0.6);
      for(var i=0;i<parallax.length;i++){
        var el=parallax[i], sp=parseFloat(el.getAttribute("data-parallax"))||0.1;
        var rc=el.getBoundingClientRect(), ctr=rc.top+rc.height/2-window.innerHeight/2;
        el.style.transform="translate3d(0,"+(-ctr*sp)+"px,0)";
      }
      ticking=false;
    });
  }
  var aboutStage=document.querySelector(".about__stage");
  if(aboutScene&&aboutStage){
    window.addEventListener("scroll",function(){
      var r=aboutStage.getBoundingClientRect();
      aboutScene.setScroll((1-(r.top+r.height/2)/window.innerHeight)*0.5);
    },{passive:true});
  }
  window.addEventListener("scroll",onScroll,{passive:true}); onScroll();

  /* ---------- reveals ---------- */
  var rev=document.querySelectorAll(".reveal,[data-stagger]");
  if("IntersectionObserver" in window && !reduce){
    var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:0.14,rootMargin:"0px 0px -8% 0px"});
    rev.forEach(function(el){io.observe(el);});
  } else { rev.forEach(function(el){el.classList.add("in");}); }

  /* ---------- mobile menu ---------- */
  var burger=document.querySelector(".burger"), mnav=document.querySelector(".mnav");
  if(burger&&mnav){
    burger.addEventListener("click",function(){
      var open=mnav.classList.toggle("open");
      burger.setAttribute("aria-expanded",open?"true":"false");
      document.body.style.overflow=open?"hidden":"";
    });
    mnav.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){mnav.classList.remove("open");burger.setAttribute("aria-expanded","false");document.body.style.overflow="";});});
  }

  /* ---------- consultation form ----------
     Emails enquiries to smithturnerconstruction@gmail.com via Web3Forms.
     Configured and live. To change the destination inbox, log in at
     https://web3forms.com and update the address on this access key.
     If the service is ever unreachable, the form falls back to opening a
     pre-filled email, so no enquiry is lost.                                  */
  var WEB3FORMS_ACCESS_KEY = "3bb0025e-878e-45b2-982f-0518ee107208";

  var form=document.getElementById("consult-form");
  if(form){
    var ok=document.getElementById("consult-ok");
    form.addEventListener("submit",function(ev){
      ev.preventDefault(); var valid=true;
      form.querySelectorAll("[required]").forEach(function(input){
        var field=input.closest(".field"), good=input.value.trim()!=="";
        if(input.type==="email") good=good&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        field.classList.toggle("invalid",!good); if(!good) valid=false;
      });
      if(!valid){var bad=form.querySelector(".field.invalid input,.field.invalid select,.field.invalid textarea");if(bad)bad.focus();return;}

      var data=new FormData(form), payload={}, lines=[];
      data.forEach(function(v,k){payload[k]=v;lines.push(k+": "+v);});
      var mail="mailto:smithturnerconstruction@gmail.com?subject="+encodeURIComponent("New enquiry — "+(data.get("name")||""))+"&body="+encodeURIComponent(lines.join("\n"));

      function reveal(openMail){
        form.style.display="none";
        if(ok){ok.classList.add("show");var l=ok.querySelector("[data-mailto]");if(l)l.setAttribute("href",mail);ok.scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"});}
        if(openMail) window.location.href=mail;
      }

      var btn=form.querySelector("button[type=submit]");
      if(btn){btn.disabled=true;btn.dataset.label=btn.textContent;btn.textContent="Sending…";}

      // Not configured yet -> open a pre-filled email instead.
      if(!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.indexOf("PASTE_YOUR")===0){
        reveal(true);
        if(btn){btn.disabled=false;if(btn.dataset.label)btn.textContent=btn.dataset.label;}
        return;
      }

      payload.access_key = WEB3FORMS_ACCESS_KEY;
      payload.subject = "New enquiry — " + (data.get("name")||"");
      payload.from_name = "Smith & Turner Website";

      fetch("https://api.web3forms.com/submit",{
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(payload)
      })
        .then(function(r){return r.json();})
        .then(function(res){ if(res && res.success){ reveal(false); } else { reveal(true); } })
        .catch(function(){ reveal(true); })
        .then(function(){ if(btn){btn.disabled=false;if(btn.dataset.label)btn.textContent=btn.dataset.label;} });
    });
    form.querySelectorAll("input,select,textarea").forEach(function(el){el.addEventListener("input",function(){el.closest(".field").classList.remove("invalid");});});
  }

  /* ---------- footer year ---------- */
  var yr=document.querySelector("[data-year]"); if(yr) yr.textContent=new Date().getFullYear();
})();
